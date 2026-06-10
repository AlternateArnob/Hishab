const db = require('../config/db');

const AccountingModel = {
  findAllTransactions: (filters = {}) => {
    const { type, account_id, from, to, limit = 20, offset = 0 } = filters;
    let where = 'WHERE 1=1';
    const params = [];
    if (type)       { where += ' AND t.type = ?';              params.push(type); }
    if (account_id) { where += ' AND t.account_id = ?';        params.push(account_id); }
    if (from)       { where += ' AND t.transaction_date >= ?'; params.push(from); }
    if (to)         { where += ' AND t.transaction_date <= ?'; params.push(to); }
    return db.query(
      `SELECT t.*, a.name AS account_name, a.type AS account_type, u.name AS created_by_name
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       JOIN users u ON t.created_by = u.id
       ${where} ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
  },

  createTransaction: (data) =>
    db.query(
      `INSERT INTO transactions (reference, type, account_id, amount, description, transaction_date, invoice_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.reference, data.type, data.account_id, data.amount,
       data.description, data.transaction_date, data.invoice_id || null, data.created_by]
    ),

  findAllAccounts: () =>
    db.query('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code'),

  findAccountByCode: (code) =>
    db.query('SELECT * FROM accounts WHERE code = ?', [code]),

  createPayment: (data) =>
    db.query(
      'INSERT INTO payments (invoice_id, amount, method, payment_date, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [data.invoice_id, data.amount, data.method || 'cash',
       data.payment_date, data.note, data.created_by]
    ),

  updateInvoicePayment: (id, amountPaid, status) =>
    db.query('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?', [amountPaid, status, id]),

  getSummary: (from, to) => {
    let where = 'WHERE 1=1';
    const params = [];
    if (from) { where += ' AND transaction_date >= ?'; params.push(from); }
    if (to)   { where += ' AND transaction_date <= ?'; params.push(to); }
    return db.query(
      `SELECT
        SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense,
        SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS net_profit
       FROM transactions ${where}`,
      params
    );
  },
};

module.exports = AccountingModel;