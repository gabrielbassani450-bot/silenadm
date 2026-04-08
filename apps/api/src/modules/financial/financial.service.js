'use strict';

// BUG CORRIGIDO: importFromSheets incrementava `imported` mesmo quando create falhava
// BUG CORRIGIDO: rows sem estrutura mínima causavam crash silencioso
// BUG CORRIGIDO: amount inválido (NaN) era salvo no banco sem validação
// BUG CORRIGIDO: date inválida criava registro com null no banco

const prisma = require('../../lib/prisma');
const { NotFoundError, AuthorizationError } = require('../../utils/errors');
const sheetsLib = require('../../lib/google-sheets');
const logger = require('../../lib/logger');

// ─── Transações ──────────────────────────────────────────────────────────────

async function listTransactions(userId, userRole, query) {
  const { page, limit, type, categoryId, startDate, endDate } = query;
  const skip = (page - 1) * limit;

  // ADMINs e MANAGERs veem todas; VIEWERs veem apenas as próprias
  const userFilter = userRole === 'VIEWER' ? { userId } : {};

  const where = {
    ...userFilter,
    ...(type && { type }),
    ...(categoryId && { categoryId }),
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        category: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total };
}

async function getTransactionById(id, userId, userRole) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      category: true,
      user: { select: { id: true, name: true } },
    },
  });

  if (!transaction) throw new NotFoundError('Transação');

  // VIEWER só pode ver as próprias
  if (userRole === 'VIEWER' && transaction.userId !== userId) {
    throw new NotFoundError('Transação'); // retorna 404 para não revelar existência
  }

  return transaction;
}

async function createTransaction(data, userId) {
  const transaction = await prisma.transaction.create({
    data: {
      ...data,
      userId,
      source: 'MANUAL',
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  logger.info(
    { txId: transaction.id, userId, type: data.type, amount: Number(data.amount) },
    'financial.create: transação criada'
  );

  // Sincronização assíncrona com Google Sheets — não bloqueia a resposta
  if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    syncTransactionToSheets(transaction).catch((err) =>
      logger.error({ txId: transaction.id, err: err.message }, 'financial.sheetsSync: falha ao sincronizar')
    );
  }

  return transaction;
}

async function updateTransaction(id, data, userId, userRole) {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Transação');

  // Retorna 404 (não 403) para não revelar existência de recursos alheios
  if (userRole === 'VIEWER' && existing.userId !== userId) {
    throw new NotFoundError('Transação');
  }

  return prisma.transaction.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  }).then((tx) => {
    logger.info({ txId: id, userId }, 'financial.update: transação atualizada');
    return tx;
  });
}

async function deleteTransaction(id, userId, userRole) {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Transação');

  // Retorna 404 (não 403) para não revelar existência de recursos alheios
  if (userRole === 'VIEWER' && existing.userId !== userId) {
    throw new NotFoundError('Transação');
  }

  await prisma.transaction.delete({ where: { id } });
  logger.info({ txId: id, userId }, 'financial.delete: transação removida');
}

// ─── Resumo financeiro ───────────────────────────────────────────────────────

async function getSummary(userId, userRole, { startDate, endDate } = {}) {
  const userFilter = userRole === 'VIEWER' ? { userId } : {};

  const dateFilter =
    startDate || endDate
      ? {
          date: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {};

  const where = { ...userFilter, ...dateFilter };

  const [receitas, despesas, byCategory] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: 'RECEITA' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'DESPESA' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Enriquece com nomes das categorias (evita que o frontend exiba UUIDs)
  const categoryIds = byCategory
    .map((c) => c.categoryId)
    .filter(Boolean);

  const categoryMap = {};
  if (categoryIds.length > 0) {
    const cats = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true },
    });
    for (const cat of cats) {
      categoryMap[cat.id] = cat;
    }
  }

  const porCategoria = byCategory.map((c) => ({
    ...c,
    category: c.categoryId ? (categoryMap[c.categoryId] || null) : null,
  }));

  const totalReceitas = Number(receitas._sum.amount || 0);
  const totalDespesas = Number(despesas._sum.amount || 0);

  return {
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    quantidadeReceitas: receitas._count,
    quantidadeDespesas: despesas._count,
    porCategoria,
  };
}

// ─── Resumo mensal (otimizado: 1 query em vez de N) ──────────────────────────

async function getMonthlySummary(userId, userRole, months = 6) {
  const userFilter = userRole === 'VIEWER' ? { userId } : {};

  const now = new Date();
  const startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1));
  const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

  const transactions = await prisma.transaction.findMany({
    where: {
      ...userFilter,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true, type: true, amount: true },
  });

  // Agrupa por mês
  const monthMap = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = { month: key, totalReceitas: 0, totalDespesas: 0 };
  }

  for (const tx of transactions) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap[key]) {
      const amount = Number(tx.amount);
      if (tx.type === 'RECEITA') monthMap[key].totalReceitas += amount;
      else monthMap[key].totalDespesas += amount;
    }
  }

  return Object.values(monthMap);
}

// ─── Categorias ──────────────────────────────────────────────────────────────

async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

// ─── Google Sheets Sync ──────────────────────────────────────────────────────

async function syncTransactionToSheets(transaction) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return;

  const row = sheetsLib.transactionToRow(transaction);
  await sheetsLib.appendRows(spreadsheetId, 'Transações!A:G', [row]);
}

async function importFromSheets(spreadsheetId, range, userId) {
  const rows = await sheetsLib.readRange(spreadsheetId, range);
  if (!rows.length) return { imported: 0, skipped: 0, errors: [] };

  // Pula cabeçalho se a primeira célula for 'ID'
  const dataRows =
    rows.length > 0 && rows[0][0] === 'ID' ? rows.slice(1) : rows;

  let skipped = 0;
  const errors = [];
  const validRecords = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    if (!Array.isArray(row) || row.length < 6) {
      skipped++;
      continue;
    }

    const [, dateStr, typeRaw, , description, amountRaw] = row;

    if (!dateStr || !typeRaw || !amountRaw) {
      skipped++;
      continue;
    }

    const amount = parseFloat(String(amountRaw).replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      errors.push({ row: i + 2, reason: `Valor inválido: "${amountRaw}"` });
      continue;
    }

    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) {
      errors.push({ row: i + 2, reason: `Data inválida: "${dateStr}"` });
      continue;
    }

    const type = typeRaw.toUpperCase() === 'RECEITA' ? 'RECEITA' : 'DESPESA';

    validRecords.push({
      userId,
      amount,
      type,
      description: description ? String(description) : null,
      date,
      source: 'GOOGLE_SHEETS',
      sheetsRowRef: String(i + 2),
    });
  }

  // Batch insert — muito mais rápido que creates sequenciais
  let imported = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.transaction.createMany({
        data: batch,
        skipDuplicates: true,
      });
      imported += result.count;
    } catch (err) {
      // Fallback: se o batch falhar, tenta individualmente
      for (const record of batch) {
        try {
          await prisma.transaction.create({ data: record });
          imported++;
        } catch (innerErr) {
          if (innerErr.code === 'P2002') {
            skipped++;
          } else {
            errors.push({ row: parseInt(record.sheetsRowRef), reason: innerErr.message });
          }
        }
      }
    }
  }

  logger.info(
    { userId, imported, skipped, errorCount: errors.length },
    'financial.importSheets: importação concluída'
  );
  return { imported, skipped, errors };
}

module.exports = {
  listTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getMonthlySummary,
  listCategories,
  importFromSheets,
};
