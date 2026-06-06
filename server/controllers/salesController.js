const db = require('../config/db');

// ── Generate order/invoice numbers ───────────────────────────
async function nextOrderNumber() {
  const [[r]] = await db.query("SELECT COUNT(*) AS c FROM sales_orders");
  return `SO-${String(r.c + 1).padStart(5, '0')}`;
}
async function nextInvoiceNumber() {
  const [[r]] = await db.query("SELECT COUNT(*) AS c FROM invoices");
  return `INV-${String(r.c + 1).padStart(5, '0')}`;
}

// ── GET /api/sales/orders ─────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { status, customer_id, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (status)      { where += ' AND o.status = ?';        params.push(status); }
    if (customer_id) { where += ' AND o.customer_id = ?';   params.push(customer_id); }
    if (search)      { where += ' AND o.order_number LIKE ?'; params.push(`%${search}%`); }

    const [rows] = await db.query(
      `SELECT o.*, c.name AS customer_name, u.name AS created_by_name
       FROM sales_orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.created_by = u.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM sales_orders o ${where}`, params
    );

    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/sales/orders/:id ─────────────────────────────────
exports.get = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM sales_orders o LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const [items] = await db.query(
      `SELECT i.*, p.name AS product_name, p.sku
       FROM sales_order_items i JOIN products p ON i.product_id = p.id
       WHERE i.order_id = ?`,
      [req.params.id]
    );
    const [invoices] = await db.query('SELECT * FROM invoices WHERE order_id = ?', [req.params.id]);

    return res.json({ success: true, data: orders[0], items, invoices });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/sales/orders ────────────────────────────────────
exports.create = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, order_date, delivery_date, discount = 0, tax = 0, notes, items } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ success: false, message: 'Order must have at least one item' });

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      item.total = (item.qty * item.unit_price) - (item.discount || 0);
      subtotal += item.total;
    }
    const total = subtotal - Number(discount) + Number(tax);
    const order_number = await nextOrderNumber();

    const [orderResult] = await conn.query(
      `INSERT INTO sales_orders (order_number, customer_id, status, order_date, delivery_date, subtotal, discount, tax, total, notes, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_number, customer_id || null, order_date, delivery_date || null, subtotal, discount, tax, total, notes, req.user.id]
    );

    const orderId = orderResult.insertId;
    for (const item of items) {
      await conn.query(
        'INSERT INTO sales_order_items (order_id, product_id, qty, unit_price, discount, total) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.qty, item.unit_price, item.discount || 0, item.total]
      );
    }

    await conn.commit();
    return res.status(201).json({ success: true, message: 'Order created', id: orderId, order_number });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ── PUT /api/sales/orders/:id/confirm ────────────────────────
// Confirms order → deducts inventory + creates invoice + accounting entry
exports.confirm = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM sales_orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'draft')
      return res.status(400).json({ success: false, message: 'Only draft orders can be confirmed' });

    const [items] = await conn.query('SELECT * FROM sales_order_items WHERE order_id = ?', [order.id]);

    // Deduct inventory for each item
    for (const item of items) {
      const [[product]] = await conn.query('SELECT stock_qty, name FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!product || product.stock_qty < item.qty) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product?.name || item.product_id}`
        });
      }
      await conn.query('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?', [item.qty, item.product_id]);
      await conn.query(
        'INSERT INTO stock_movements (product_id, type, qty, reference, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [item.product_id, 'out', item.qty, order.order_number, `Sale: ${order.order_number}`, req.user.id]
      );
    }

    // Update order status
    await conn.query("UPDATE sales_orders SET status = 'confirmed' WHERE id = ?", [order.id]);

    // Create invoice
    const invoice_number = await nextInvoiceNumber();
    const due_date = new Date(); due_date.setDate(due_date.getDate() + 30);
    const [[invoiceResult]] = await conn.query(
      `INSERT INTO invoices (invoice_number, order_id, customer_id, status, issue_date, due_date, amount_due, created_by)
       VALUES (?, ?, ?, 'unpaid', NOW(), ?, ?, ?)`,
      [invoice_number, order.id, order.customer_id, due_date.toISOString().split('T')[0], order.total, req.user.id]
    );

    // Accounting entry: income
    await conn.query(
      `INSERT INTO transactions (reference, type, account_id, amount, description, transaction_date, invoice_id, created_by)
       VALUES (?, 'income', (SELECT id FROM accounts WHERE code = '4001'), ?, ?, NOW(), ?, ?)`,
      [order.order_number, order.total, `Sales revenue: ${order.order_number}`, invoiceResult?.insertId || null, req.user.id]
    );

    await conn.commit();
    return res.json({ success: true, message: 'Order confirmed, invoice and accounting entries created', invoice_number });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ── PUT /api/sales/orders/:id/cancel ─────────────────────────
exports.cancel = async (req, res) => {
  try {
    const [[order]] = await db.query('SELECT status FROM sales_orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'delivered')
      return res.status(400).json({ success: false, message: 'Delivered orders cannot be cancelled' });

    await db.query("UPDATE sales_orders SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    return res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/sales/invoices ───────────────────────────────────
exports.invoices = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND i.status = ?'; params.push(status); }

    const [rows] = await db.query(
      `SELECT i.*, c.name AS customer_name, o.order_number
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN sales_orders o ON i.order_id = o.id
       ${where}
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM invoices i ${where}`, params);

    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/sales/stats ──────────────────────────────────────
exports.stats = async (req, res) => {
  try {
    const [[orders]] = await db.query(
      `SELECT
        COUNT(*) AS total_orders,
        SUM(status = 'draft')     AS draft,
        SUM(status = 'confirmed') AS confirmed,
        SUM(status = 'delivered') AS delivered,
        SUM(status = 'cancelled') AS cancelled,
        SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS total_revenue
       FROM sales_orders`
    );
    const [[invoices]] = await db.query(
      `SELECT
        SUM(amount_due)  AS total_due,
        SUM(amount_paid) AS total_paid,
        SUM(status = 'overdue') AS overdue_count
       FROM invoices`
    );
    return res.json({ success: true, data: { ...orders, ...invoices } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};