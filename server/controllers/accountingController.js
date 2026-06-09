const db = require('../config/db');

// ── GET /api/accounting/transactions ──────────────────────────
exports.list = async (req, res) => {
  try {
    const { type, account_id, from, to, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (type)       { where += ' AND t.type = ?';              params.push(type); }
    if (account_id) { where += ' AND t.account_id = ?';        params.push(account_id); }
    if (from)       { where += ' AND t.transaction_date >= ?'; params.push(from); }
    if (to)         { where += ' AND t.transaction_date <= ?'; params.push(to); }

    const [rows] = await db.query(
      `SELECT t.*, a.name AS account_name, a.type AS account_type, u.name AS created_by_name
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       JOIN users u ON t.created_by = u.id
       ${where}
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM transactions t ${where}`, params
    );

    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/accounting/transactions ─────────────────────────
exports.create = async (req, res) => {
  try {
    const { reference, type, account_id, amount, description, transaction_date } = req.body;
    if (!reference || !type || !account_id || !amount || !transaction_date)
      return res.status(400).json({ success: false, message: 'Missing required fields' });

    const [result] = await db.query(
      `INSERT INTO transactions (reference, type, account_id, amount, description, transaction_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reference, type, account_id, amount, description, transaction_date, req.user.id]
    );
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/accounting/payments ─────────────────────────────
exports.recordPayment = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { invoice_id, amount, method, payment_date, note } = req.body;
    if (!invoice_id || !amount || !payment_date)
      return res.status(400).json({ success: false, message: 'invoice_id, amount, payment_date required' });

    const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoice_id]);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    // Record payment
    await conn.query(
      'INSERT INTO payments (invoice_id, amount, method, payment_date, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [invoice_id, amount, method || 'cash', payment_date, note, req.user.id]
    );

    const newPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
    let newStatus = 'partial';
    if (newPaid >= invoice.amount_due) newStatus = 'paid';

    await conn.query(
      'UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?',
      [newPaid, newStatus, invoice_id]
    );

    // Accounting entry: cash received
    await conn.query(
      `INSERT INTO transactions (reference, type, account_id, amount, description, transaction_date, invoice_id, created_by)
       VALUES (?, 'income', (SELECT id FROM accounts WHERE code = '1001'), ?, ?, ?, ?, ?)`,
      [`PAY-${invoice.invoice_number}`, amount, `Payment received for ${invoice.invoice_number}`, payment_date, invoice_id, req.user.id]
    );

    await conn.commit();
    return res.json({ success: true, message: 'Payment recorded', new_status: newStatus });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ── GET /api/accounting/accounts ──────────────────────────────
exports.accounts = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/accounting/summary ───────────────────────────────
exports.summary = async (req, res) => {
  try {
    const { from, to } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from) { where += ' AND transaction_date >= ?'; params.push(from); }
    if (to)   { where += ' AND transaction_date <= ?'; params.push(to); }

    const [[summary]] = await db.query(
      `SELECT
        SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
        SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS net_profit
       FROM transactions ${where}`,
      params
    );
    return res.json({ success: true, data: summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};