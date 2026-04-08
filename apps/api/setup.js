/**
 * setup.js — Executa a configuração inicial do ambiente
 * Uso: node setup.js
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n=== Dashboard ADM — Setup Inicial ===\n');

// Gera segredos seguros
const accessSecret = crypto.randomBytes(64).toString('hex');
const refreshSecret = crypto.randomBytes(64).toString('hex');
const cookieSecret = crypto.randomBytes(32).toString('hex');

const envPath = path.join(__dirname, '.env');
let env = fs.readFileSync(envPath, 'utf8');

env = env
  .replace(/JWT_ACCESS_SECRET=.*/,  `JWT_ACCESS_SECRET=${accessSecret}`)
  .replace(/JWT_REFRESH_SECRET=.*/, `JWT_REFRESH_SECRET=${refreshSecret}`)
  .replace(/COOKIE_SECRET=.*/,      `COOKIE_SECRET=${cookieSecret}`);

fs.writeFileSync(envPath, env);

console.log('✓ Segredos JWT e Cookie gerados e salvos no .env');
console.log('\nPróximos passos:');
console.log('  1. Certifique-se que o PostgreSQL está rodando (docker-compose up -d)');
console.log('  2. cd apps/api');
console.log('  3. npm install');
console.log('  4. npm run db:migrate:dev -- --name init');
console.log('  5. node prisma/seed.js');
console.log('  6. npm run dev');
console.log('\nCredenciais padrão do admin:');
console.log('  E-mail: admin@dashboard.com');
console.log('  Senha:  Admin@123456');
console.log('\n⚠️  Troque a senha do admin após o primeiro login!\n');
