const db = require('../config/db');

// ── GET /api/analytics/dashboard ─────────────────────────────
exports.dashboard = async (req, res) => {
  try {
    const [revenueByDay] = await db.query(
      `SELECT DATE(transaction_date) AS date, SUM(amount) AS revenue
       FROM transactions
       WHERE type = 'income' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(transaction_date) ORDER BY date ASC`
    );
    const [revenueByMonth] = await db.query(
      `SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS month, SUM(amount) AS revenue
       FROM transactions
       WHERE type = 'income' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month ASC`
    );
    const [topProducts] = await db.query(
      `SELECT p.name, p.sku, SUM(i.qty) AS total_sold, SUM(i.total) AS total_revenue
       FROM sales_order_items i
       JOIN products p ON i.product_id = p.id
       JOIN sales_orders o ON i.order_id = o.id
       WHERE o.status != 'cancelled'
       GROUP BY p.id ORDER BY total_sold DESC LIMIT 5`
    );
    const [customerGrowth] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS new_customers
       FROM customers
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month ASC`
    );
    const [[kpi]] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE status = 'customer') AS active_customers,
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'confirmed') AS open_orders,
        (SELECT SUM(amount_due - amount_paid) FROM invoices WHERE status IN ('unpaid','partial','overdue')) AS outstanding_receivable,
        (SELECT SUM(amount) FROM transactions WHERE type = 'income' AND MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())) AS revenue_this_month,
        (SELECT SUM(amount) FROM transactions WHERE type = 'expense' AND MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())) AS expenses_this_month,
        (SELECT COUNT(*) FROM products WHERE stock_qty <= min_stock_qty AND is_active = 1) AS low_stock_alerts`
    );
    return res.json({ success: true, data: { kpi, revenueByDay, revenueByMonth, topProducts, customerGrowth } });
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

// ── POST /api/analytics/track ─────────────────────────────────
exports.track = async (req, res) => {
  try {
    const userId = req.user.id;
    const { action_type, section, item_id, item_label, api_method, api_path, status } = req.body;
    const validActions = ['view','create','edit','delete','login','export','report'];
    const resolvedAction = validActions.includes(action_type) ? action_type : 'view';
    await db.query(
      `INSERT INTO user_history
         (user_id, action_type, section, item_id, item_label, api_method, api_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, resolvedAction, section || 'unknown', item_id || null,
       item_label || null, api_method || null, api_path || null, status || 'success']
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('track error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/analytics/insights ───────────────────────────────
exports.insights = async (req, res) => {
  try {
    const userId = req.user.id;
    const { range = '30' } = req.query;
    const days = [7, 30, 90].includes(Number(range)) ? Number(range) : 30;

    const [activityByDay] = await db.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS total,
              SUM(status = 'success') AS successes,
              SUM(status = 'error')   AS errors
       FROM user_history
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [userId, days]
    );

    const [actionBreakdown] = await db.query(
      `SELECT action_type, COUNT(*) AS count
       FROM user_history
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY action_type ORDER BY count DESC`,
      [userId, days]
    );

    const [sectionBreakdown] = await db.query(
      `SELECT section, COUNT(*) AS count
       FROM user_history
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY section ORDER BY count DESC`,
      [userId, days]
    );

    const [hourlyActivity] = await db.query(
      `SELECT HOUR(created_at) AS hour, COUNT(*) AS count
       FROM user_history
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY HOUR(created_at) ORDER BY hour ASC`,
      [userId, days]
    );

    const [weeklyTrend] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%u') AS week,
              COUNT(*) AS total_actions,
              COUNT(DISTINCT DATE(created_at)) AS active_days
       FROM user_history
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
       GROUP BY DATE_FORMAT(created_at, '%Y-%u') ORDER BY week ASC`,
      [userId]
    );

    const [[summary]] = await db.query(
      `SELECT
         COUNT(*)                           AS total_actions,
         SUM(status = 'success')            AS successful_actions,
         SUM(status = 'error')              AS failed_actions,
         COUNT(DISTINCT DATE(created_at))   AS active_days,
         COUNT(DISTINCT section)            AS sections_visited,
         COUNT(DISTINCT item_id)            AS unique_items_interacted
       FROM user_history
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days]
    );

    const peakHour = hourlyActivity.reduce((best, h) => (!best || h.count > best.count) ? h : best, null)?.hour ?? null;

    const [[prevSummary]] = await db.query(
      `SELECT COUNT(*) AS total_actions FROM user_history
       WHERE user_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND created_at <  DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days * 2, days]
    );

    const [recentActivity] = await db.query(
      `SELECT id, action_type, section, item_label, api_method, api_path, status, created_at
       FROM user_history WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        summary: {
          ...summary,
          most_common_action:   actionBreakdown[0]?.action_type  || null,
          most_visited_section: sectionBreakdown[0]?.section     || null,
          peak_hour:            peakHour,
          prev_total_actions:   prevSummary.total_actions || 0,
        },
        activityByDay,
        actionBreakdown,
        sectionBreakdown,
        hourlyActivity,
        weeklyTrend,
        recentActivity,
      }
    });
  } catch (err) {
    console.error('insights error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/analytics/insights/recalculate ─────────────────
exports.recalculate = async (req, res) => {
  try {
    const userId = req.user.id;
    const [months] = await db.query(
      `SELECT DISTINCT DATE_FORMAT(created_at, '%Y-%m') AS period
       FROM user_history WHERE user_id = ?`,
      [userId]
    );

    for (const { period } of months) {
      const [[stats]] = await db.query(
        `SELECT COUNT(*) AS total_actions,
                SUM(status = 'success') AS successful_actions,
                SUM(status = 'error')   AS failed_actions,
                COUNT(DISTINCT DATE(created_at)) AS active_days,
                COUNT(DISTINCT item_id) AS unique_items_interacted
         FROM user_history
         WHERE user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
        [userId, period]
      );
      const [[actionRow]] = await db.query(
        `SELECT action_type FROM user_history
         WHERE user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?
         GROUP BY action_type ORDER BY COUNT(*) DESC LIMIT 1`,
        [userId, period]
      );
      const [[sectionRow]] = await db.query(
        `SELECT section FROM user_history
         WHERE user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?
         GROUP BY section ORDER BY COUNT(*) DESC LIMIT 1`,
        [userId, period]
      );
      const [[hourRow]] = await db.query(
        `SELECT HOUR(created_at) AS peak_hour FROM user_history
         WHERE user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?
         GROUP BY HOUR(created_at) ORDER BY COUNT(*) DESC LIMIT 1`,
        [userId, period]
      );
      await db.query(
        `INSERT INTO user_analytics_summary
           (user_id, period, total_actions, successful_actions, failed_actions,
            most_common_action, most_visited_section, unique_items_interacted,
            active_days, peak_hour, last_calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           total_actions           = VALUES(total_actions),
           successful_actions      = VALUES(successful_actions),
           failed_actions          = VALUES(failed_actions),
           most_common_action      = VALUES(most_common_action),
           most_visited_section    = VALUES(most_visited_section),
           unique_items_interacted = VALUES(unique_items_interacted),
           active_days             = VALUES(active_days),
           peak_hour               = VALUES(peak_hour),
           last_calculated_at      = NOW()`,
        [userId, period,
         stats.total_actions, stats.successful_actions, stats.failed_actions,
         actionRow?.action_type || null, sectionRow?.section || null,
         stats.unique_items_interacted, stats.active_days, hourRow?.peak_hour ?? null]
      );
    }

    const [summaries] = await db.query(
      `SELECT period, total_actions, most_common_action, most_visited_section,
              active_days, last_calculated_at
       FROM user_analytics_summary WHERE user_id = ?
       ORDER BY period DESC`,
      [userId]
    );

    return res.json({ success: true, data: summaries, recalculated: months.length });
  } catch (err) {
    console.error('recalculate error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
