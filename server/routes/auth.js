// server/routes/auth.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.post('/login',    ctrl.login);
router.post('/register', auth, role('admin'), ctrl.register);
router.get('/me',        auth, ctrl.me);
router.get('/users',     auth, role('admin', 'manager'), ctrl.listUsers);

module.exports = router;