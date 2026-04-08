'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Middleware de validação via Zod.
 * Uso: validate(schema) onde schema tem { body?, query?, params? }
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [key, zodSchema] of Object.entries(schema)) {
      if (!zodSchema) continue;
      const result = zodSchema.safeParse(req[key]);

      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        errors.push(...issues);
      } else {
        req[key] = result.data; // substitui pelo dado limpo e transformado
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Dados inválidos', errors));
    }

    next();
  };
}

module.exports = { validate };
