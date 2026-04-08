'use strict';

// BUG CORRIGIDO: upsert usava `id: cat.name` (campo errado) — corrigido para `name: cat.name`
// BUG CORRIGIDO: categoria.name agora tem @unique no schema, permitindo upsert correto

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // ── Admin padrão ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dashboard.com' },
    update: {},              // se já existe, não atualiza (preserva senha alterada)
    create: {
      name: 'Administrador',
      email: 'admin@dashboard.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // ── Categorias padrão ────────────────────────────────────────────────────
  const categories = [
    { name: 'Salário',       type: 'RECEITA', color: '#22c55e' },
    { name: 'Investimentos', type: 'RECEITA', color: '#3b82f6' },
    { name: 'Freelance',     type: 'RECEITA', color: '#a855f7' },
    { name: 'Alimentação',   type: 'DESPESA', color: '#ef4444' },
    { name: 'Transporte',    type: 'DESPESA', color: '#f97316' },
    { name: 'Moradia',       type: 'DESPESA', color: '#eab308' },
    { name: 'Saúde',         type: 'DESPESA', color: '#ec4899' },
    { name: 'Educação',      type: 'DESPESA', color: '#06b6d4' },
    { name: 'Lazer',         type: 'DESPESA', color: '#8b5cf6' },
    { name: 'Outros',        type: 'DESPESA', color: '#6b7280' },
  ];

  let categoriesCreated = 0;
  for (const cat of categories) {
    // upsert correto: `name` tem @unique no schema
    const result = await prisma.category.upsert({
      where: { name: cat.name },
      update: { color: cat.color },   // atualiza cor se já existir
      create: cat,
    });
    if (result) categoriesCreated++;
  }

  console.log('\n✅ Seed concluído!');
  console.log(`   Usuário admin : ${admin.email}`);
  console.log(`   Senha padrão  : Admin@123456`);
  console.log(`   Categorias    : ${categoriesCreated} processadas`);
  console.log('\n⚠️  Troque a senha padrão após o primeiro login!\n');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
