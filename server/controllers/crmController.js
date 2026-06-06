const db = require('../config/db');

// ── GET /api/crm/customers ────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND c.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [rows] = await db.query(
      `SELECT c.*, u.name AS assigned_name
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM customers c ${where}`, params
    );

    return res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/crm/customers/:id ────────────────────────────────
exports.get = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, u.name AS assigned_name
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });

    const [activities] = await db.query(
      `SELECT a.*, u.name AS user_name
       FROM customer_activities a
       JOIN users u ON a.user_id = u.id
       WHERE a.customer_id = ?
       ORDER BY a.activity_date DESC`,
      [req.params.id]
    );

    return res.json({ success: true, data: rows[0], activities });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/crm/customers ───────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, email, phone, company, address, status, source, notes, assigned_to } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const [result] = await db.query(
      `INSERT INTO customers (name, email, phone, company, address, status, source, notes, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, company, address, status || 'lead', source || 'other', notes, assigned_to || null, req.user.id]
    );

    return res.status(201).json({ success: true, message: 'Customer created', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/crm/customers/:id ────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { name, email, phone, company, address, status, source, notes, assigned_to } = req.body;
    await db.query(
      `UPDATE customers SET name=?, email=?, phone=?, company=?, address=?, status=?, source=?, notes=?, assigned_to=?
       WHERE id=?`,
      [name, email, phone, company, address, status, source, notes, assigned_to || null, req.params.id]
    );
    return res.json({ success: true, message: 'Customer updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/crm/customers/:id (admin only) ────────────────
exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/crm/customers/:id/activities ────────────────────
exports.addActivity = async (req, res) => {
  try {
    const { type, description } = req.body;
    if (!type || !description)
      return res.status(400).json({ success: false, message: 'Type and description required' });

    await db.query(
      'INSERT INTO customer_activities (customer_id, user_id, type, description) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, type, description]
    );
    return res.status(201).json({ success: true, message: 'Activity logged' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/crm/stats ────────────────────────────────────────
exports.stats = async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT
        COUNT(*) AS total,
        SUM(status = 'lead')      AS leads,
        SUM(status = 'prospect')  AS prospects,
        SUM(status = 'customer')  AS customers,
        SUM(status = 'inactive')  AS inactive
       FROM customers`
    );
    return res.json({ success: true, data: counts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};