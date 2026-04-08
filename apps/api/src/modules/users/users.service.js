'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const { NotFoundError, AuthorizationError, AppError } = require('../../utils/errors');
const { invalidateUserCache } = require('../../middleware/authenticate');
const logger = require('../../lib/logger');

const USER_SELECT = {
  id: true, name: true, email: true, cpf: true,
  role: true, isActive: true, createdAt: true,
};

async function listUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

async function getUserById(targetId, requesterId, requesterRole) {
  if (requesterRole === 'VIEWER' && requesterId !== targetId) {
    throw new AuthorizationError('Sem permissão para acessar dados de outro usuário');
  }

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: USER_SELECT,
  });

  if (!user) throw new NotFoundError('Usuário');
  return user;
}

async function updateUser(targetId, body, requesterId, requesterRole) {
  const isOwnProfile = requesterId === targetId;
  const isAdmin = requesterRole === 'ADMIN';

  if (!isOwnProfile && !isAdmin) {
    throw new AuthorizationError('Sem permissão para editar este usuário');
  }

  const { password, role, isActive, ...safeData } = body;
  const updateData = { ...safeData };

  if (isAdmin) {
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
  }

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('Nenhum campo para atualizar', 400, 'BAD_REQUEST');
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: updateData,
    select: { ...USER_SELECT, updatedAt: true },
  });

  invalidateUserCache(targetId);
  logger.info(
    { targetUserId: targetId, updatedBy: requesterId, fields: Object.keys(updateData) },
    'users.update: usuário atualizado'
  );
  return updated;
}

async function deactivateUser(targetId, requesterId) {
  if (targetId === requesterId) {
    throw new AppError('Não é possível desativar a própria conta', 400, 'BAD_REQUEST');
  }

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new NotFoundError('Usuário');

  await prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
  });

  invalidateUserCache(targetId);

  await prisma.refreshToken.updateMany({
    where: { userId: targetId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  logger.info(
    { targetUserId: targetId, deactivatedBy: requesterId },
    'users.delete: usuário desativado (soft-delete)'
  );
}

module.exports = { listUsers, getUserById, updateUser, deactivateUser };
