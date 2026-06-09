const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/accountingController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.use(auth);
router.get('/accounts',      role('admin', 'manager'), ctrl.accounts);
router.get('/transactions',  role('admin', 'manager'), ctrl.list);
router.post('/transactions', role('admin', 'manager'), ctrl.create);
router.post('/payments',     role('admin', 'manager'), ctrl.recordPayment);
router.get('/summary',       role('admin', 'manager'), ctrl.summary);

module.exports = router;
