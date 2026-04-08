'use strict';

// BUG CORRIGIDO: transform `new Date(d)` aceitava datas inválidas como "2024-02-30"
// (JavaScript cria Invalid Date silenciosamente). Adicionado .refine() para validar.

const { z } = require('zod');

/**
 * Valida que uma string de data no formato YYYY-MM-DD representa uma data real.
 */
function isValidDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine(isValidDate, 'Data inválida (ex: 31/02 não existe)')
  .transform((d) => new Date(d + 'T00:00:00Z'));  // força UTC para evitar drift de timezone

const createTransactionSchema = {
  body: z.object({
    amount: z
      .number({ required_error: 'Valor obrigatório' })
      .positive('Valor deve ser positivo')
      .max(9999999999999.99, 'Valor máximo excedido')
      .multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais'),
    type: z.enum(['RECEITA', 'DESPESA'], {
      required_error: 'Tipo obrigatório (RECEITA ou DESPESA)',
    }),
    description: z.string().max(255).optional(),
    date: dateField,
    categoryId: z.string().uuid('ID de categoria inválido').optional(),
  }),
};

const updateTransactionSchema = {
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
  body: z.object({
    amount: z.number().positive().multipleOf(0.01).optional(),
    type: z.enum(['RECEITA', 'DESPESA']).optional(),
    description: z.string().max(255).optional(),
    date: dateField.optional(),
    categoryId: z.string().uuid().nullable().optional(),
  }),
};

const listTransactionsSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(['RECEITA', 'DESPESA']).optional(),
    categoryId: z.string().uuid().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidDate, 'startDate inválida')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidDate, 'endDate inválida')
      .optional(),
  }),
};

const idParamSchema = {
  params: z.object({ id: z.string().uuid('ID inválido') }),
};

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsSchema,
  idParamSchema,
  isValidDate,
};
