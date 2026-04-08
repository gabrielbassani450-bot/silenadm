'use strict';

// BUG CORRIGIDO: `require('../../lib/prisma')` inline dentro do handler /me
// causava re-avaliação do módulo a cada request (apesar do cache do Node, é má prática).
// Movido para o topo do arquivo.
//
// BUG CORRIGIDO: cookie path '/api/auth' estava correto em escopo, mas
// clearCookie em logout/logout-all também precisa usar o mesmo path — confirmado.

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../../lib/prisma');
const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.schema');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/authenticate');
const { NotFoundError } = require('../../utils/errors');
const { success, created } = require('../../utils/response');

const router = Router();

// Rate limit específico para rotas de autenticação (10 tentativas / 15 min por IP+email)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    },
  },
});

// Rate limit para refresh (30 req/15min — defesa em profundidade)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas tentativas de refresh. Tente novamente em 15 minutos.',
    },
  },
});

// Opções do cookie de refresh token
// path: '/api/auth' — cookie só é enviado para rotas de auth (correto por design)
// O access token vai no header Authorization para todas as outras rotas
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                                          // inacessível ao JS
  secure: process.env.NODE_ENV === 'production',           // HTTPS apenas em prod
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // lax em dev (sem HTTPS)
  maxAge: 7 * 24 * 60 * 60 * 1000,                        // 7 dias em ms
  path: '/api/auth',                                       // escopo correto
};

// POST /api/auth/register  (auto-cadastro público — role fixada em VIEWER)
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      // selfRegister=true força role VIEWER, ignorando qualquer role enviada no body
      const user = await authService.register(req.body, { selfRegister: true });
      created(res, user);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const { accessToken, refreshToken, user } = await authService.login(
        req.body,
        ipAddress
      );

      // Refresh token em cookie HttpOnly (inacessível ao JS — protege contra XSS)
      res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

      success(res, { accessToken, user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;
    const { accessToken, refreshToken } = await authService.refresh(rawRefreshToken);

    // Rotation: cookie com novo token
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    success(res, { accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;
    await authService.logout(rawRefreshToken);

    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
    success(res, { message: 'Logout realizado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout-all  (revoga todos os tokens do usuário em todos os devices)
router.post('/logout-all', authenticate, async (req, res, next) => {
  try {
    await authService.logoutAll(req.user.id);
    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
    success(res, { message: 'Logout em todos os dispositivos realizado' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, cpf: true,
        role: true, isActive: true, createdAt: true,
      },
    });

    if (!user) throw new NotFoundError('Usuário');

    success(res, user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
