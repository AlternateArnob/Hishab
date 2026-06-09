const db = require('../config/db');

// ── GET /api/inventory/products ───────────────────────────────
exports.list = async (req, res) => {
  try {
    const { category_id, search, low_stock, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE p.is_active = 1';
    const params = [];

    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
    if (low_stock === 'true') { where += ' AND p.stock_qty <= p.min_stock_qty'; }
    if (search) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY p.name ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`, params
    );

    return res.json({ success: true, data: rows, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/inventory/products/:id ──────────────────────────
exports.get = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });

    const [movements] = await db.query(
      `SELECT m.*, u.name AS user_name
       FROM stock_movements m JOIN users u ON m.created_by = u.id
       WHERE m.product_id = ?
       ORDER BY m.created_at DESC LIMIT 50`,
      [req.params.id]
    );

    return res.json({ success: true, data: rows[0], movements });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/inventory/products ─────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, sku, category_id, description, unit, cost_price, selling_price, stock_qty, min_stock_qty } = req.body;
    if (!name || !sku) return res.status(400).json({ success: false, message: 'Name and SKU required' });

    const [result] = await db.query(
      `INSERT INTO products (name, sku, category_id, description, unit, cost_price, selling_price, stock_qty, min_stock_qty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sku, category_id || null, description, unit || 'pcs',
       cost_price || 0, selling_price || 0, stock_qty || 0, min_stock_qty || 0, req.user.id]
    );

    // Log initial stock
    if (stock_qty > 0) {
      await db.query(
        'INSERT INTO stock_movements (product_id, type, qty, reference, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [result.insertId, 'in', stock_qty, 'INITIAL', 'Initial stock on product creation', req.user.id]
      );
    }

    return res.status(201).json({ success: true, message: 'Product created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'SKU already exists' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/inventory/products/:id ──────────────────────────
exports.update = async (req, res) => {
  try {
    const { name, sku, category_id, description, unit, cost_price, selling_price, min_stock_qty, is_active } = req.body;
    await db.query(
      `UPDATE products SET name=?, sku=?, category_id=?, description=?, unit=?,
       cost_price=?, selling_price=?, min_stock_qty=?, is_active=? WHERE id=?`,
      [name, sku, category_id || null, description, unit, cost_price, selling_price, min_stock_qty, is_active !== false ? 1 : 0, req.params.id]
    );
    return res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/inventory/products/:id/adjust ──────────────────
exports.adjustStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { type, qty, note } = req.body;  // type: in | out | adjustment
    if (!type || !qty) return res.status(400).json({ success: false, message: 'Type and qty required' });

    const [[product]] = await conn.query('SELECT stock_qty FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let newQty = product.stock_qty;
    if (type === 'in')         newQty += Number(qty);
    else if (type === 'out')   newQty -= Number(qty);
    else                       newQty  = Number(qty);  // adjustment = set to value

    if (newQty < 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    await conn.query('UPDATE products SET stock_qty = ? WHERE id = ?', [newQty, req.params.id]);
    await conn.query(
      'INSERT INTO stock_movements (product_id, type, qty, note, created_by) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, type, qty, note || null, req.user.id]
    );

    await conn.commit();
    return res.json({ success: true, message: 'Stock adjusted', new_qty: newQty });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ── GET /api/inventory/categories ────────────────────────────
exports.categories = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/inventory/stats ──────────────────────────────────
exports.stats = async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT
        COUNT(*) AS total_products,
        SUM(stock_qty) AS total_stock,
        SUM(stock_qty * cost_price) AS stock_value,
        SUM(stock_qty <= min_stock_qty) AS low_stock_count
       FROM products WHERE is_active = 1`
    );
    return res.json({ success: true, data: counts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};