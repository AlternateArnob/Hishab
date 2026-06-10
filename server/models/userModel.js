const db = require('../config/db');

const UserModel = {
  findByEmail: (email) =>
    db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]),

  findById: (id) =>
    db.query('SELECT id, name, email, role, avatar, is_active, created_at FROM users WHERE id = ?', [id]),

  findAll: () =>
    db.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'),

  create: (name, email, hashedPassword, role) =>
    db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, role]),

  update: (id, fields) => {
    const keys   = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    return db.query(`UPDATE users SET ${keys} WHERE id = ?`, values);
  },

  deactivate: (id) =>
    db.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]),
};

module.exports = UserModel;