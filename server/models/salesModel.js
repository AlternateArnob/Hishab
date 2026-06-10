const db = require('../config/db');

const SalesModel = {
  findAllOrders: (filters = {}) => {
    const { status, customer_id, search, limit = 20, offset = 0 } = filters;
    let where = 'WHERE 1=1';
    const params = [];
    if (status)      { where += ' AND o.status = ?';         params.push(status); }
    if (customer_id) { where += ' AND o.customer_id = ?';    params.push(customer_id); }
    if (search)      { where += ' AND o.order_number LIKE ?'; params.push(`%${search}%`); }
    return db.query(
      `SELECT o.*, c.name AS customer_name, u.name AS created_by_name
       FROM sales_orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.created_by = u.id
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
  },

  findOrderById: (id) =>
    db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM sales_orders o LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [id]
    ),

  getOrderItems: (orderId) =>
    db.query(
      `SELECT i.*, p.name AS product_name, p.sku
       FROM sales_order_items i JOIN products p ON i.product_id = p.id
       WHERE i.order_id = ?`,
      [orderId]
    ),

  createOrder: (data) =>
    db.query(
      `INSERT INTO sales_orders (order_number, customer_id, status, order_date, delivery_date, subtotal, discount, tax, total, notes, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.order_number, data.customer_id || null, data.order_date,
       data.delivery_date || null, data.subtotal, data.discount || 0,
       data.tax || 0, data.total, data.notes, data.created_by]
    ),

  addOrderItem: (orderId, item) =>
    db.query(
      'INSERT INTO sales_order_items (order_id, product_id, qty, unit_price, discount, total) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, item.product_id, item.qty, item.unit_price, item.discount || 0, item.total]
    ),

  updateOrderStatus: (id, status) =>
    db.query('UPDATE sales_orders SET status = ? WHERE id = ?', [status, id]),

  findAllInvoices: (filters = {}) => {
    const { status, limit = 20, offset = 0 } = filters;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND i.status = ?'; params.push(status); }
    return db.query(
      `SELECT i.*, c.name AS customer_name, o.order_number
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN sales_orders o ON i.order_id = o.id
       ${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
  },

  createInvoice: (data) =>
    db.query(
      `INSERT INTO invoices (invoice_number, order_id, customer_id, status, issue_date, due_date, amount_due, created_by)
       VALUES (?, ?, ?, 'unpaid', NOW(), ?, ?, ?)`,
      [data.invoice_number, data.order_id, data.customer_id || null,
       data.due_date, data.amount_due, data.created_by]
    ),

  getStats: () =>
    db.query(
      `SELECT COUNT(*) AS total_orders,
        SUM(status='draft') AS draft, SUM(status='confirmed') AS confirmed,
        SUM(status='delivered') AS delivered, SUM(status='cancelled') AS cancelled,
        SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS total_revenue
       FROM sales_orders`
    ),
};

module.exports = SalesModel;