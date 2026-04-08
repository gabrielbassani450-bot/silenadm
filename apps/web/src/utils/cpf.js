/**
 * Valida um CPF brasileiro.
 * Aceita com ou sem máscara (123.456.789-09 ou 12345678909).
 */
export function isValidCPF(cpf) {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem === 10) rem = 0
  if (rem !== Number(digits[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem === 10) rem = 0
  if (rem !== Number(digits[10])) return false

  return true
}

/**
 * Aplica máscara de CPF conforme o usuário digita.
 * "12345678909" → "123.456.789-09"
 */
export function maskCPF(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
