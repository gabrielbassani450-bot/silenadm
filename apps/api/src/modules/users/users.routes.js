'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { success, noContent } = require('../../utils/response');
const { passwordField, cpfField } = require('../auth/auth.schema');
const usersService = require('./users.service');

const router = Router();

router.use(authenticate);

// GET /api/users  (somente ADMIN)
router.get('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const users = await usersService.listUsers();
    success(res, users);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid('ID inválido') }) }),
  async (req, res, next) => {
    try {
      const user = await usersService.getUserById(req.params.id, req.user.id, req.user.role);
      success(res, user);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/users/:id  (ADMIN edita qualquer um; usuário edita o próprio nome/senha)
router.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid('ID inválido') }),
    body: z.object({
      name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100).optional(),
      cpf: cpfField.optional(),
      password: passwordField.optional(),
      role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']).optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const updated = await usersService.updateUser(req.params.id, req.body, req.user.id, req.user.role);
      success(res, updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:id  (somente ADMIN, soft delete via isActive=false)
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: z.object({ id: z.string().uuid('ID inválido') }) }),
  async (req, res, next) => {
    try {
      await usersService.deactivateUser(req.params.id, req.user.id);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
