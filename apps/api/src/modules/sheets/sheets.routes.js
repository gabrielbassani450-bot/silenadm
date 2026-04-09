'use strict';

// BUG CORRIGIDO: sem rate limiting por usuário — MANAGER podia fazer leituras
// ilimitadas da Sheets API (que tem limite de 300 req/min por projeto Google)
// BUG CORRIGIDO: erros da Google API propagavam stack trace sem tratamento amigável

const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const sheetsLib = require('../../lib/google-sheets');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const { success } = require('../../utils/response');

const router = Router();

// Rate limit específico para Sheets — 20 req/min por usuário
// (skip em serverless — store in-memory reseta a cada cold start)
if (!process.env.VERCEL) {
  const sheetsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.user?.id || req.ip, // por usuário autenticado
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Limite de requisições ao Google Sheets excedido. Aguarde 1 minuto.',
      },
    },
  });
  router.use(sheetsLimiter);
}

router.use(authenticate, authorize('MANAGER'));

/**
 * Converte erros da Google API em erros amigáveis.
 */
function handleGoogleError(err, next) {
  const status = err?.response?.status || err?.status;
  const message = err?.response?.data?.error?.message || err?.message || 'Erro desconhecido';

  if (status === 403) {
    return next(new AppError(
      'Sem permissão para acessar esta planilha. ' +
      'Verifique se ela foi compartilhada com a Service Account.',
      403, 'SHEETS_FORBIDDEN'
    ));
  }
  if (status === 404) {
    return next(new AppError(
      'Planilha não encontrada. Verifique o spreadsheetId.',
      404, 'SHEETS_NOT_FOUND'
    ));
  }
  if (status === 400) {
    return next(new AppError(
      `Range inválido na planilha: ${message}`,
      400, 'SHEETS_BAD_REQUEST'
    ));
  }
  if (err?.message?.includes('GOOGLE_SERVICE_ACCOUNT')) {
    return next(new AppError(
      'Credenciais do Google Sheets não configuradas no servidor.',
      503, 'SHEETS_NOT_CONFIGURED'
    ));
  }
  return next(new AppError(`Erro ao acessar Google Sheets: ${message}`, 502, 'SHEETS_ERROR'));
}

// GET /api/sheets/read?spreadsheetId=...&range=...
router.get(
  '/read',
  validate({
    query: z.object({
      spreadsheetId: z.string().min(1, 'spreadsheetId obrigatório').max(200),
      range: z.string().min(1, 'range obrigatório').max(100),
    }),
  }),
  async (req, res, next) => {
    try {
      const { spreadsheetId, range } = req.query;
      const rows = await sheetsLib.readRange(spreadsheetId, range);
      success(res, { rows, count: rows.length });
    } catch (err) {
      handleGoogleError(err, next);
    }
  }
);

// POST /api/sheets/append
router.post(
  '/append',
  validate({
    body: z.object({
      spreadsheetId: z.string().min(1, 'spreadsheetId obrigatório').max(200),
      range: z.string().min(1, 'range obrigatório').max(100),
      values: z
        .array(z.array(z.union([z.string(), z.number(), z.null()])))
        .min(1, 'Ao menos uma linha é obrigatória')
        .max(1000, 'Máximo de 1000 linhas por chamada'),
    }),
  }),
  async (req, res, next) => {
    try {
      const { spreadsheetId, range, values } = req.body;
      const result = await sheetsLib.appendRows(spreadsheetId, range, values);
      success(res, result);
    } catch (err) {
      handleGoogleError(err, next);
    }
  }
);

module.exports = router;
