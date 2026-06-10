const db = require('../config/db');

const InventoryModel = {
  findAllProducts: (filters = {}) => {
    const { category_id, search, low_stock, limit = 20, offset = 0 } = filters;
    let where = 'WHERE p.is_active = 1';
    const params = [];
    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
    if (low_stock)   { where += ' AND p.stock_qty <= p.min_stock_qty'; }
    if (search)      { where += ' AND (p.name LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    return db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       ${where} ORDER BY p.name ASC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
  },

  findProductById: (id) =>
    db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    ),

  createProduct: (data) =>
    db.query(
      `INSERT INTO products (name, sku, category_id, description, unit, cost_price, selling_price, stock_qty, min_stock_qty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.sku, data.category_id || null, data.description,
       data.unit || 'pcs', data.cost_price || 0, data.selling_price || 0,
       data.stock_qty || 0, data.min_stock_qty || 0, data.created_by]
    ),

  updateProduct: (id, data) =>
    db.query(
      `UPDATE products SET name=?, sku=?, category_id=?, description=?, unit=?,
       cost_price=?, selling_price=?, min_stock_qty=?, is_active=? WHERE id=?`,
      [data.name, data.sku, data.category_id || null, data.description, data.unit,
       data.cost_price, data.selling_price, data.min_stock_qty,
       data.is_active !== false ? 1 : 0, id]
    ),

  updateStock: (id, qty) =>
    db.query('UPDATE products SET stock_qty = ? WHERE id = ?', [qty, id]),

  logMovement: (productId, type, qty, reference, note, userId) =>
    db.query(
      'INSERT INTO stock_movements (product_id, type, qty, reference, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [productId, type, qty, reference || null, note || null, userId]
    ),

  getMovements: (productId) =>
    db.query(
      `SELECT m.*, u.name AS user_name FROM stock_movements m
       JOIN users u ON m.created_by = u.id
       WHERE m.product_id = ? ORDER BY m.created_at DESC LIMIT 50`,
      [productId]
    ),

  getCategories: () =>
    db.query('SELECT * FROM categories ORDER BY name'),

  getStats: () =>
    db.query(
      `SELECT COUNT(*) AS total_products, SUM(stock_qty) AS total_stock,
        SUM(stock_qty * cost_price) AS stock_value,
        SUM(stock_qty <= min_stock_qty) AS low_stock_count
       FROM products WHERE is_active = 1`
    ),
};

module.exports = InventoryModel;