'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} = require('../../utils/errors');
const logger = require('../../lib/logger');

// ─── Helpers de token ────────────────────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken() {
  // Token opaco — 64 bytes aleatórios
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshExpiresAt() {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '7', 10);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// ─── Service ─────────────────────────────────────────────────────────────────

async function register({ name, email, cpf, password, role }, { selfRegister = false } = {}) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.warn({ email }, 'auth.register: e-mail já cadastrado');
    throw new ConflictError('E-mail já cadastrado');
  }

  if (cpf) {
    const existingCpf = await prisma.user.findUnique({ where: { cpf } });
    if (existingCpf) {
      logger.warn('auth.register: CPF já cadastrado');
      throw new ConflictError('CPF já cadastrado');
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const resolvedRole = selfRegister ? 'VIEWER' : (role || 'VIEWER');

  const user = await prisma.user.create({
    data: { name, email, cpf: cpf || null, passwordHash, role: resolvedRole },
    select: { id: true, name: true, email: true, cpf: true, role: true, createdAt: true },
  });

  logger.info({ userId: user.id, email, role: resolvedRole }, 'auth.register: conta criada');
  return user;
}

async function login({ email, password }, ipAddress) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Constant-time: sempre executa bcrypt.compare mesmo se o usuário não existir
  // Evita timing attack para enumeração de e-mails
  const DUMMY_HASH = '$2a$12$000000000000000000000uGWBGgBa2k6G50uFAyAsTGJfRhEI6bGG';
  const passwordValid = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH
  );

  if (!user || !passwordValid) {
    logger.warn({ email, ip: ipAddress }, 'auth.login: credenciais inválidas');
    throw new AuthenticationError('E-mail ou senha incorretos');
  }

  if (!user.isActive) {
    logger.warn({ userId: user.id, email }, 'auth.login: conta desativada');
    throw new AuthenticationError('Conta desativada. Contate o administrador.');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const familyId = crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: getRefreshExpiresAt(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      resource: 'auth',
      ipAddress,
    },
  });

  logger.info({ userId: user.id, email, ip: ipAddress }, 'auth.login: sucesso');
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      role: user.role,
    },
  };
}

async function refresh(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AuthenticationError('Refresh token não fornecido');
  }

  const tokenHash = hashToken(rawRefreshToken);

  // Transação serializável para evitar race condition na rotação de tokens.
  // Importante: não lançar erro dentro da transação (causaria rollback da revogação).
  const result = await prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });

    // Detecção de reuso — se token já foi revogado, revogar toda a família
    if (stored?.revokedAt) {
      logger.error({ familyId: stored.familyId, userId: stored.userId }, 'auth.refresh: REUSO DE TOKEN DETECTADO — família revogada');
      await tx.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() },
      });
      return { error: 'reuse' };
    }

    if (!stored || stored.expiresAt < new Date()) {
      return { error: 'expired' };
    }

    // Buscar usuário atualizado
    const user = await tx.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      return { error: 'inactive' };
    }

    // Revogar token atual e criar novo (rotation) — dentro da mesma transação
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        familyId: stored.familyId, // mesma família
        expiresAt: getRefreshExpiresAt(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }, { isolationLevel: 'Serializable' });

  // Lançar erros FORA da transação (após commit bem-sucedido da revogação)
  if (result.error === 'reuse') {
    throw new AuthenticationError('Token inválido. Faça login novamente por segurança.');
  }
  if (result.error === 'expired') {
    throw new AuthenticationError('Refresh token expirado ou inválido');
  }
  if (result.error === 'inactive') {
    throw new AuthenticationError('Usuário não encontrado ou inativo');
  }

  return { accessToken: result.accessToken, refreshToken: result.refreshToken };
}

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;

  const tokenHash = hashToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { userId: true, revokedAt: true },
  });

  if (!stored || stored.revokedAt) return;

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId: stored.userId, action: 'LOGOUT', resource: 'auth' },
  });

  logger.info({ userId: stored.userId }, 'auth.logout: sessão encerrada');
}

async function logoutAll(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Remove tokens expirados ou revogados há mais de 30 dias.
 * Chamado periodicamente para manter a tabela limpa.
 */
async function cleanupExpiredTokens() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: cutoff } },
      ],
    },
  });

  if (result.count > 0) {
    logger.info({ deleted: result.count }, 'auth.cleanup: tokens expirados removidos');
  }
  return result.count;
}

module.exports = { register, login, refresh, logout, logoutAll, cleanupExpiredTokens };
