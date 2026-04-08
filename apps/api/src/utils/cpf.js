'use strict';

/**
 * Valida um CPF brasileiro.
 * Aceita com ou sem máscara (123.456.789-09 ou 12345678909).
 * Retorna true se válido, false se inválido.
 */
function isValidCPF(cpf) {
  // Remove máscara
  const digits = cpf.replace(/\D/g, '');

  // Deve ter exatamente 11 dígitos
  if (digits.length !== 11) return false;

  // Rejeita sequências repetidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Cálculo do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  // Cálculo do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(digits[10])) return false;

  return true;
}

/**
 * Normaliza CPF removendo máscara: "123.456.789-09" → "12345678909"
 */
function normalizeCPF(cpf) {
  return cpf.replace(/\D/g, '');
}

/**
 * Formata CPF com máscara: "12345678909" → "123.456.789-09"
 */
function formatCPF(cpf) {
  const d = normalizeCPF(cpf);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

module.exports = { isValidCPF, normalizeCPF, formatCPF };
