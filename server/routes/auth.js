const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleGuard');

router.post('/login',              ctrl.login);
router.post('/register',           auth, role('admin'), ctrl.register);
router.get('/me',                  auth, ctrl.me);
router.get('/users',               auth, role('admin', 'manager'), ctrl.listUsers);
router.patch('/users/:id/role',    auth, role('admin'), ctrl.updateRole);
router.patch('/users/:id/status',  auth, role('admin'), ctrl.updateStatus);
router.post('/change-password',    auth, ctrl.changePassword);
router.patch('/users/:id/password',auth, role('admin'), ctrl.resetPassword);
router.patch('/users/:id/name',    auth, role('admin'), ctrl.updateName);
router.delete('/users/:id',        auth, role('admin'), ctrl.deleteUser);

module.exports = router;