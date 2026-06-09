const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/inventoryController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.use(auth);
router.get('/stats',                  ctrl.stats);
router.get('/categories',             ctrl.categories);
router.get('/products',               ctrl.list);
router.get('/products/:id',           ctrl.get);
router.post('/products',              role('admin', 'manager'), ctrl.create);
router.put('/products/:id',           role('admin', 'manager'), ctrl.update);
router.post('/products/:id/adjust',   role('admin', 'manager'), ctrl.adjustStock);

module.exports = router;
