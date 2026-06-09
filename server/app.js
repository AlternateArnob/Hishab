const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve static frontend ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'client')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/crm',         require('./routes/crm'));
app.use('/api/inventory',   require('./routes/inventory'));
app.use('/api/sales',       require('./routes/sales'));

app.use('/api/accounting',  require('./routes/accounting'));
app.use('/api/analytics',   require('./routes/analytics'));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'hishab-erp' }));

// ── Fallback to frontend SPA ──────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'pages', 'login.html'));
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;