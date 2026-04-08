'use strict';

// BUG CORRIGIDO: JSON.parse sem try-catch causava crash não tratado se
// GOOGLE_SERVICE_ACCOUNT_JSON tivesse JSON inválido
// BUG CORRIGIDO: transactionToRow assumia que `date` era sempre um Date object —
// qualquer null/string causaria crash

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let _auth = null;

/**
 * Retorna cliente autenticado para Google Sheets.
 * Suporta duas formas de credencial:
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON (string JSON) — para deploy em nuvem
 *   2. GOOGLE_SERVICE_ACCOUNT_KEY_PATH (caminho do arquivo) — para local
 */
function getAuth() {
  if (_auth) return _auth;

  let credentials;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    // BUG CORRIGIDO: parse sem tratamento de erro
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON contém JSON inválido. ' +
        'Verifique a variável de ambiente.'
      );
    }
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);

    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `Arquivo de credenciais Google não encontrado em: ${keyPath}\n` +
        'Verifique GOOGLE_SERVICE_ACCOUNT_KEY_PATH no .env'
      );
    }

    try {
      credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    } catch {
      throw new Error(
        `Arquivo de credenciais em ${keyPath} contém JSON inválido.`
      );
    }
  } else {
    throw new Error(
      'Credenciais Google Sheets não configuradas. ' +
      'Defina GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_KEY_PATH no .env'
    );
  }

  // Valida campos mínimos da Service Account
  if (!credentials.type || credentials.type !== 'service_account') {
    throw new Error(
      'Credencial Google inválida: type deve ser "service_account". ' +
      'Certifique-se de estar usando uma Service Account, não OAuth client.'
    );
  }

  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return _auth;
}

/**
 * Lê um range de uma planilha.
 * @param {string} spreadsheetId
 * @param {string} range  ex: "Sheet1!A1:Z100"
 * @returns {Promise<string[][]>}
 */
async function readRange(spreadsheetId, range) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

/**
 * Escreve valores em um range específico (sobrescreve).
 * @param {string} spreadsheetId
 * @param {string} range
 * @param {Array<Array<string|number>>} values
 */
async function writeRange(spreadsheetId, range, values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  return response.data;
}

/**
 * Adiciona linhas ao final de um range (append).
 * @param {string} spreadsheetId
 * @param {string} range
 * @param {Array<Array<string|number>>} values
 */
async function appendRows(spreadsheetId, range, values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  return response.data;
}

/**
 * Converte dados financeiros do DB para formato de linha do Sheets.
 * BUG CORRIGIDO: date pode ser null/undefined/string — agora com fallback seguro.
 */
function transactionToRow(transaction) {
  // Converte Date ou string para YYYY-MM-DD de forma segura
  let dateStr = '';
  if (transaction.date) {
    const d = transaction.date instanceof Date
      ? transaction.date
      : new Date(transaction.date);

    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().split('T')[0];
    }
  }

  return [
    transaction.id,
    dateStr,
    transaction.type,
    transaction.category?.name || '',
    transaction.description || '',
    Number(transaction.amount) || 0,
    transaction.source,
  ];
}

/**
 * Cabeçalho padrão das transações na planilha.
 */
const TRANSACTION_HEADERS = [
  'ID',
  'Data',
  'Tipo',
  'Categoria',
  'Descrição',
  'Valor',
  'Fonte',
];

module.exports = {
  readRange,
  writeRange,
  appendRows,
  transactionToRow,
  TRANSACTION_HEADERS,
};
