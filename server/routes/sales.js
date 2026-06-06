const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/salesController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.use(auth);
router.get('/stats',              ctrl.stats);
router.get('/orders',             ctrl.list);
router.get('/orders/:id',         ctrl.get);
router.post('/orders',            ctrl.create);
router.put('/orders/:id/confirm', ctrl.confirm);
router.put('/orders/:id/cancel',  role('admin','manager'), ctrl.cancel);
router.get('/invoices',           ctrl.invoices);

module.exports = router;