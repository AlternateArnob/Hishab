const db = require('../config/db');

// ── GET /api/analytics/dashboard ─────────────────────────────
exports.dashboard = async (req, res) => {
  try {
    // Revenue last 30 days
    const [revenueByDay] = await db.query(
      `SELECT DATE(transaction_date) AS date, SUM(amount) AS revenue
       FROM transactions
       WHERE type = 'income' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(transaction_date)
       ORDER BY date ASC`
    );

    // Revenue last 6 months
    const [revenueByMonth] = await db.query(
      `SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS month, SUM(amount) AS revenue
       FROM transactions
       WHERE type = 'income' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month ASC`
    );

    // Top selling products
    const [topProducts] = await db.query(
      `SELECT p.name, p.sku, SUM(i.qty) AS total_sold, SUM(i.total) AS total_revenue
       FROM sales_order_items i
       JOIN products p ON i.product_id = p.id
       JOIN sales_orders o ON i.order_id = o.id
       WHERE o.status != 'cancelled'
       GROUP BY p.id ORDER BY total_sold DESC LIMIT 5`
    );

    // Customer growth last 6 months
    const [customerGrowth] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS new_customers
       FROM customers
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month ASC`
    );

    // KPIs
    const [[kpi]] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE status = 'customer') AS active_customers,
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'confirmed') AS open_orders,
        (SELECT SUM(amount_due - amount_paid) FROM invoices WHERE status IN ('unpaid','partial','overdue')) AS outstanding_receivable,
        (SELECT SUM(amount) FROM transactions WHERE type = 'income' AND MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())) AS revenue_this_month,
        (SELECT SUM(amount) FROM transactions WHERE type = 'expense' AND MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())) AS expenses_this_month,
        (SELECT COUNT(*) FROM products WHERE stock_qty <= min_stock_qty AND is_active = 1) AS low_stock_alerts`
    );

    return res.json({
      success: true,
      data: { kpi, revenueByDay, revenueByMonth, topProducts, customerGrowth }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/analytics/sales-report ──────────────────────────
exports.salesReport = async (req, res) => {
  try {
    const { from, to, group_by = 'month' } = req.query;
    const format = group_by === 'day' ? '%Y-%m-%d' : group_by === 'week' ? '%Y-%u' : '%Y-%m';
    let where = "WHERE o.status != 'cancelled'";
    const params = [];
    if (from) { where += ' AND o.order_date >= ?'; params.push(from); }
    if (to)   { where += ' AND o.order_date <= ?'; params.push(to); }

    const [rows] = await db.query(
      `SELECT DATE_FORMAT(o.order_date, '${format}') AS period,
              COUNT(o.id) AS order_count, SUM(o.total) AS revenue
       FROM sales_orders o ${where}
       GROUP BY period ORDER BY period ASC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/analytics/inventory-report ───────────────────────
exports.inventoryReport = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.name, p.sku, p.stock_qty, p.min_stock_qty, p.cost_price, p.selling_price,
              c.name AS category,
              (p.stock_qty * p.cost_price) AS stock_value,
              CASE WHEN p.stock_qty <= 0 THEN 'out_of_stock'
                   WHEN p.stock_qty <= p.min_stock_qty THEN 'low'
                   ELSE 'ok' END AS stock_status
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY p.stock_qty ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};