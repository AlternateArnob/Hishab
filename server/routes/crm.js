const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/crmController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.use(auth);
router.get('/stats',                ctrl.stats);
router.get('/customers',            ctrl.list);
router.get('/customers/:id',        ctrl.get);
router.post('/customers',           ctrl.create);
router.put('/customers/:id',        ctrl.update);
router.delete('/customers/:id',     role('admin'), ctrl.remove);
router.post('/customers/:id/activities', ctrl.addActivity);

module.exports = router;