const db = require('../config/db');

const CustomerModel = {
  findAll: (filters = {}) => {
    const { status, search, limit = 20, offset = 0 } = filters;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    return db.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
  },

  findById: (id) =>
    db.query(
      `SELECT c.*, u.name AS assigned_name
       FROM customers c LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = ?`,
      [id]
    ),

  create: (data) =>
    db.query(
      `INSERT INTO customers (name, email, phone, company, address, status, source, notes, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.email, data.phone, data.company, data.address,
       data.status || 'lead', data.source || 'other', data.notes,
       data.assigned_to || null, data.created_by]
    ),

  update: (id, data) =>
    db.query(
      `UPDATE customers SET name=?, email=?, phone=?, company=?, address=?, status=?, source=?, notes=?, assigned_to=?
       WHERE id=?`,
      [data.name, data.email, data.phone, data.company, data.address,
       data.status, data.source, data.notes, data.assigned_to || null, id]
    ),

  delete: (id) =>
    db.query('DELETE FROM customers WHERE id = ?', [id]),

  countByStatus: () =>
    db.query(
      `SELECT COUNT(*) AS total,
        SUM(status='lead') AS leads, SUM(status='prospect') AS prospects,
        SUM(status='customer') AS customers, SUM(status='inactive') AS inactive
       FROM customers`
    ),

  getActivities: (customerId) =>
    db.query(
      `SELECT a.*, u.name AS user_name
       FROM customer_activities a JOIN users u ON a.user_id = u.id
       WHERE a.customer_id = ? ORDER BY a.activity_date DESC`,
      [customerId]
    ),

  addActivity: (customerId, userId, type, description) =>
    db.query(
      'INSERT INTO customer_activities (customer_id, user_id, type, description) VALUES (?, ?, ?, ?)',
      [customerId, userId, type, description]
    ),
};

module.exports = CustomerModel;