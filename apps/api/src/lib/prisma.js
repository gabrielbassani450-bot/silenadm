'use strict';

const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

// Singleton: reutiliza a mesma instância em hot-reload (dev)
const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
      ...(process.env.PRISMA_QUERY_LOG === 'true'
        ? [{ level: 'query', emit: 'event' }]
        : []),
    ],
  });

// Redireciona logs do Prisma para Pino estruturado
prisma.$on('error', (e) => logger.error({ prisma: true, target: e.target }, e.message));
prisma.$on('warn', (e) => logger.warn({ prisma: true, target: e.target }, e.message));

if (process.env.PRISMA_QUERY_LOG === 'true') {
  prisma.$on('query', (e) =>
    logger.debug({ prisma: true, duration: `${e.duration}ms` }, e.query)
  );
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
