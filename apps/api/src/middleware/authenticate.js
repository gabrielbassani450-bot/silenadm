'use strict';

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { AuthenticationError } = require('../utils/errors');

// ─── Cache de usuários ativos ─────────────────────────────────────────────
// Evita hit no banco a cada requisição autenticada.
// TTL curto (30s) garante que desativações se propagam rapidamente.
const USER_CACHE_TTL = 30_000; // 30 segundos
const USER_CACHE_MAX = 500;    // evita memory leak em cenários extremos
const userCache = new Map();

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > USER_CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(userId, user) {
  // Evict oldest entries se atingir o limite
  if (userCache.size >= USER_CACHE_MAX) {
    const oldest = userCache.keys().next().value;
    userCache.delete(oldest);
  }
  userCache.set(userId, { user, ts: Date.now() });
}

/** Invalida cache de um usuário específico (chamado ao desativar/atualizar) */
function invalidateUserCache(userId) {
  userCache.delete(userId);
}

/**
 * Middleware de autenticação via JWT.
 * Espera o header: Authorization: Bearer <access_token>
 * Popula req.user com { id, email, role }
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token de acesso não fornecido');
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expirado. Faça refresh do token.');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Token malformado ou assinatura inválida');
      }
      if (err.name === 'NotBeforeError') {
        throw new AuthenticationError('Token ainda não é válido');
      }
      throw new AuthenticationError('Token inválido');
    }

    // Tenta cache primeiro, depois banco
    let user = getCachedUser(payload.sub);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (user && user.isActive) {
        setCachedUser(payload.sub, user);
      }
    }

    if (!user) {
      throw new AuthenticationError('Usuário não encontrado');
    }

    if (!user.isActive) {
      userCache.delete(payload.sub);
      throw new AuthenticationError('Conta desativada. Contate o administrador.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, invalidateUserCache };
