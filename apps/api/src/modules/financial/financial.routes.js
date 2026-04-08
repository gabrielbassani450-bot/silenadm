'use strict';

const { Router } = require('express');
const service = require('./financial.service');
const {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsSchema,
  idParamSchema,
} = require('./financial.schema');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { success, created, noContent, paginated } = require('../../utils/response');

const router = Router();

// Todas as rotas exigem autenticação
router.use(authenticate);

// GET /api/financial/summary
const { z } = require('zod');
const { isValidDate } = require('./financial.schema');
const summarySchema = {
  query: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').refine(isValidDate, 'startDate inválida').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').refine(isValidDate, 'endDate inválida').optional(),
  }),
};
router.get('/summary', validate(summarySchema), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await service.getSummary(req.user.id, req.user.role, {
      startDate,
      endDate,
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /api/financial/summary/monthly?months=6
const monthlySummarySchema = {
  query: z.object({
    months: z.coerce.number().int().min(1).max(12).default(6),
  }),
};
router.get('/summary/monthly', validate(monthlySummarySchema), async (req, res, next) => {
  try {
    const data = await service.getMonthlySummary(req.user.id, req.user.role, req.query.months);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /api/financial/categories
router.get('/categories', async (req, res, next) => {
  try {
    const data = await service.listCategories();
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /api/financial/transactions
router.get(
  '/transactions',
  validate(listTransactionsSchema),
  async (req, res, next) => {
    try {
      const { transactions, total } = await service.listTransactions(
        req.user.id,
        req.user.role,
        req.query
      );
      paginated(res, transactions, {
        page: req.query.page,
        limit: req.query.limit,
        total,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/financial/transactions/:id
router.get(
  '/transactions/:id',
  validate(idParamSchema),
  async (req, res, next) => {
    try {
      const data = await service.getTransactionById(
        req.params.id,
        req.user.id,
        req.user.role
      );
      success(res, data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/financial/transactions
router.post(
  '/transactions',
  validate(createTransactionSchema),
  async (req, res, next) => {
    try {
      const data = await service.createTransaction(req.body, req.user.id);
      created(res, data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/financial/transactions/:id
router.patch(
  '/transactions/:id',
  validate(updateTransactionSchema),
  async (req, res, next) => {
    try {
      const data = await service.updateTransaction(
        req.params.id,
        req.body,
        req.user.id,
        req.user.role
      );
      success(res, data);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/financial/transactions/:id
router.delete(
  '/transactions/:id',
  validate(idParamSchema),
  async (req, res, next) => {
    try {
      await service.deleteTransaction(req.params.id, req.user.id, req.user.role);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/financial/import-sheets  (importar do Google Sheets)
router.post(
  '/import-sheets',
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const { spreadsheetId, range } = req.body;
      if (!spreadsheetId || !range) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'spreadsheetId e range são obrigatórios' },
        });
      }
      const result = await service.importFromSheets(
        spreadsheetId,
        range,
        req.user.id
      );
      success(res, result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
