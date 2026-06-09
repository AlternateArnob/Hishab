const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/analyticsController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.use(auth);
router.get('/dashboard',        role('admin', 'manager'), ctrl.dashboard);
router.get('/sales-report',     role('admin', 'manager'), ctrl.salesReport);
router.get('/inventory-report', role('admin', 'manager'), ctrl.inventoryReport);

module.exports = router;
