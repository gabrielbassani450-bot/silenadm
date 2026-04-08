'use strict';

const { z } = require('zod');
const { isValidCPF, normalizeCPF } = require('../../utils/cpf');

// Campos reutilizáveis de validação
const passwordField = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .max(72, 'Senha deve ter no máximo 72 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter ao menos um caractere especial');

const cpfField = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos')
  .refine(isValidCPF, 'CPF inválido');

const registerSchema = {
  body: z.object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
    email: z.string().email('E-mail inválido').toLowerCase(),
    cpf: cpfField.optional(),
    password: passwordField,
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().email('E-mail inválido').toLowerCase(),
    password: z.string().min(1, 'Senha obrigatória'),
  }),
};

module.exports = { registerSchema, loginSchema, passwordField, cpfField };
