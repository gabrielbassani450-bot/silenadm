'use strict';

// BUG CORRIGIDO: .datetime() sem `{ offset: true }` rejeitava "2024-03-15T10:00:00"
// (sem timezone). Com offset: true aceita com ou sem offset, incluindo Z e +HH:MM.

const { z } = require('zod');

// Campo datetime flexível: aceita ISO 8601 com ou sem offset
const datetimeField = z
  .string()
  .datetime({ offset: true, message: 'Data deve ser ISO 8601 (ex: 2024-03-15T10:00:00Z)' });

const createMeetingSchema = {
  body: z
    .object({
      title: z.string().min(2, 'Título deve ter ao menos 2 caracteres').max(200),
      description: z.string().max(2000).optional(),
      startAt: datetimeField,
      endAt: datetimeField,
      location: z.string().max(300).optional(),
      attendeeIds: z.array(z.string().uuid('ID de participante inválido')).optional().default([]),
    })
    .refine(
      (data) => new Date(data.endAt) > new Date(data.startAt),
      { message: 'endAt deve ser posterior a startAt', path: ['endAt'] }
    ),
};

const updateMeetingSchema = {
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: z
    .object({
      title: z.string().min(2).max(200).optional(),
      description: z.string().max(2000).optional(),
      startAt: datetimeField.optional(),
      endAt: datetimeField.optional(),
      location: z.string().max(300).optional(),
      attendeeIds: z.array(z.string().uuid('ID de participante inválido')).optional(),
    })
    .refine(
      (data) => {
        // Só valida se ambos foram fornecidos
        if (data.startAt && data.endAt) {
          return new Date(data.endAt) > new Date(data.startAt);
        }
        return true;
      },
      { message: 'endAt deve ser posterior a startAt', path: ['endAt'] }
    ),
};

const listMeetingsSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
      .refine((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, day));
        return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === day;
      }, 'Data inválida')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
      .refine((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, day));
        return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === day;
      }, 'Data inválida')
      .optional(),
  }),
};

const idParamSchema = {
  params: z.object({ id: z.string().uuid('ID inválido') }),
};

module.exports = {
  createMeetingSchema,
  updateMeetingSchema,
  listMeetingsSchema,
  idParamSchema,
};
