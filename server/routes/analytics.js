const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/analyticsController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.use(auth);

// Business analytics (admin/manager only)
router.get('/dashboard',                    role('admin', 'manager'), ctrl.dashboard);
router.get('/sales-report',                 role('admin', 'manager'), ctrl.salesReport);
router.get('/inventory-report',             role('admin', 'manager'), ctrl.inventoryReport);

// Personal activity insights (all authenticated users)
router.post('/track',                       ctrl.track);
router.get('/insights',                     ctrl.insights);
router.post('/insights/recalculate',        ctrl.recalculate);

module.exports = router;
