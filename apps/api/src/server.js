'use strict';

// Carrega variáveis de ambiente ANTES de qualquer import
require('dotenv').config();

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./lib/logger');

// ─── Rotas ───────────────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const financialRoutes = require('./modules/financial/financial.routes');
const meetingsRoutes = require('./modules/meetings/meetings.routes');
const usersRoutes = require('./modules/users/users.routes');
const sheetsRoutes = require('./modules/sheets/sheets.routes');

// ─── Validação de variáveis obrigatórias ─────────────────────────────────────
// BUG CORRIGIDO: COOKIE_SECRET não estava na lista — cookieParser silenciosamente
// aceitava cookies não assinados, comprometendo a segurança do refresh token
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'COOKIE_SECRET',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.fatal({ key }, 'Variável de ambiente obrigatória ausente');
    if (!process.env.VERCEL) process.exit(1);
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────
const app = express();

// Trust proxy: necessário para rate-limiting e logging correto atrás de reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Compressão gzip/deflate — reduz ~30% o tamanho das respostas
app.use(compression());

// Segurança: headers HTTP hardening
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.bunny.net'],
        fontSrc: ["'self'", 'https://fonts.bunny.net'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    } : false, // Desativa CSP em dev para evitar conflitos com Vite HMR
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS: aceita somente origens explicitamente permitidas
// BUG CORRIGIDO: antes aceitava qualquer CORS_ORIGIN sem validação —
// um valor mal configurado poderia permitir origens arbitrárias com credentials
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requests sem origin (curl, Postman, mobile) apenas em dev
      if (!origin) {
        if (process.env.NODE_ENV === 'production') {
          return callback(new Error('Origin não permitida'));
        }
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origem não permitida — ${origin}`));
    },
    credentials: true, // necessário para cookies HttpOnly
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limit global (por IP)
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Limite de requisições excedido' },
    },
  })
);

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Request ID — identifica cada requisição para correlação de logs
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Logs HTTP via Pino (substitui morgan — formato estruturado)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      reqId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    }, 'http.request');
  });
  next();
});

// ─── Rotas ───────────────────────────────────────────────────────────────────

// Health check (sem autenticação — usado por load balancers)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sheets', sheetsRoutes);

// ─── Frontend estático (produção standalone — não Vercel) ────────────────────
// Em produção standalone, serve o build do frontend. No Vercel, o CDN cuida disso.
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const webDist = path.join(__dirname, '../../web/dist');
  app.use(express.static(webDist, { maxAge: '30d', immutable: true }));

  // SPA fallback: qualquer rota não-API retorna index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// 404 para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não existe` },
  });
});

// Handler global de erros (DEVE ser o último middleware)
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    logger.info({
      env: process.env.NODE_ENV || 'development',
      port: PORT,
      health: `http://localhost:${PORT}/health`,
    }, 'Dashboard ADM — API iniciada');

    // Limpeza periódica de tokens expirados (a cada 6h)
    const { cleanupExpiredTokens } = require('./modules/auth/auth.service');
    setInterval(() => {
      cleanupExpiredTokens().catch((err) =>
        logger.error({ err: err.message }, 'Falha na limpeza de tokens')
      );
    }, 6 * 60 * 60 * 1000);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido. Encerrando servidor...');
    server.close(() => {
      require('./lib/prisma').$disconnect().then(() => {
        logger.info('Servidor encerrado.');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT recebido. Encerrando servidor...');
    server.close(() => {
      require('./lib/prisma').$disconnect().then(() => {
        process.exit(0);
      });
    });
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Exceção não capturada');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Promise rejeitada sem handler');
    process.exit(1);
  });
}

module.exports = app;
