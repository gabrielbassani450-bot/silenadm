'use strict';

// BUG CORRIGIDO: apenas P2002 e P2025 eram tratados — outros erros Prisma
// (constraint FK, transaction abort, query inválida) caíam no handler genérico
// sem mensagem útil. Adicionados P2003, P2014, P2016, P2021.

const { AppError } = require('../utils/errors');
const logger = require('../lib/logger');

/**
 * Mapeamento de códigos de erro do Prisma para respostas HTTP.
 */
const PRISMA_ERROR_MAP = {
  P2002: { status: 409, code: 'CONFLICT',          message: 'Registro duplicado' },
  P2003: { status: 400, code: 'CONSTRAINT_ERROR',  message: 'Referência inválida: registro relacionado não existe' },
  P2014: { status: 400, code: 'CONSTRAINT_ERROR',  message: 'Violação de relação obrigatória' },
  P2016: { status: 400, code: 'QUERY_ERROR',       message: 'Erro na consulta ao banco de dados' },
  P2021: { status: 503, code: 'DB_UNAVAILABLE',    message: 'Tabela não encontrada — execute as migrations' },
  P2025: { status: 404, code: 'NOT_FOUND',         message: 'Registro não encontrado' },
};

/**
 * Middleware global de tratamento de erros.
 * Deve ser registrado por ÚLTIMO no Express.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log estruturado via Pino
  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId: req.id,
    userId: req.user?.id,
    errName: err.name,
    errCode: err.code,
  };

  // Erros operacionais (4xx) → warn; Erros inesperados (5xx) → error
  if (err instanceof AppError) {
    logger.warn({ ...logPayload, statusCode: err.statusCode }, `errorHandler: ${err.message}`);
  } else {
    logger.error({ ...logPayload, err }, 'errorHandler: erro inesperado');
  }

  // Erro de JSON malformado (body parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'JSON malformado no corpo da requisição' },
    });
  }

  // Erros operacionais conhecidos (AppError e subclasses)
  if (err instanceof AppError) {
    const body = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    if (err.details) body.error.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Erros do Prisma — mapeados para respostas amigáveis
  if (err.code && PRISMA_ERROR_MAP[err.code]) {
    const { status, code, message } = PRISMA_ERROR_MAP[err.code];
    return res.status(status).json({ success: false, error: { code, message } });
  }

  // Erros de conexão com banco (ex: banco offline ao reiniciar)
  if (err.message?.includes('connect ECONNREFUSED') ||
      err.message?.includes('database') ||
      err.constructor?.name === 'PrismaClientInitializationError') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DB_CONNECTION_ERROR',
        message: 'Não foi possível conectar ao banco de dados',
      },
    });
  }

  // Erro de CORS (origem não permitida)
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({
      success: false,
      error: { code: 'CORS_ERROR', message: 'Origem não permitida' },
    });
  }

  // Erro genérico — não expor detalhes em produção
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'Erro interno do servidor',
      ...(isDev && { stack: err.stack }),
    },
  });
}

module.exports = { errorHandler };
