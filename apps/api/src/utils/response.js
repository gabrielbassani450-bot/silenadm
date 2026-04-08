'use strict';

/**
 * Resposta de sucesso padronizada
 */
function success(res, data, statusCode = 200, meta = null) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

/**
 * Resposta de criação (201)
 */
function created(res, data) {
  return success(res, data, 201);
}

/**
 * Resposta sem conteúdo (204)
 */
function noContent(res) {
  return res.status(204).send();
}

/**
 * Resposta paginada
 */
function paginated(res, data, { page, limit, total }) {
  return success(res, data, 200, {
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

module.exports = { success, created, noContent, paginated };
