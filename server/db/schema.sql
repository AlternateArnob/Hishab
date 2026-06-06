-- ============================================================
--  HISHAB ERP - Full Database Schema
--  Modules: Auth, CRM, Sales, Inventory, Accounting, Analytics
--
--  HOW TO RUN
--  ----------
--  Local (CLI):
--    mysql -u root -p hishab_db < schema.sql
--                   ^^^^^^^^^^
--                   pass your DB name as a flag — no USE needed
--
--  Hosted / MySQL Workbench / phpMyAdmin:
--    1. Create (or select) your database first in the host panel
--    2. Open this file and run it — it will execute on whatever
--       database your connection is already pointed at
--    3. Do NOT add USE or CREATE DATABASE — your host controls that
-- ============================================================

-- Disable FK checks so drops and creates work in any order
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
--  DROP EXISTING TABLES (clean slate — safe to re-run)
-- ============================================================
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS sales_order_items;
DROP TABLE IF EXISTS sales_orders;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customer_activities;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

-- ============================================================
--  MODULE 0: AUTH & USERS
-- ============================================================

CREATE TABLE users (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL,
  password    VARCHAR(255)  NOT NULL,
  role        ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  avatar      VARCHAR(255)  DEFAULT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  MODULE 1: CRM (Customers & Leads)
-- ============================================================

CREATE TABLE customers (
  id            INT           NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150)  NOT NULL,
  email         VARCHAR(150)  DEFAULT NULL,
  phone         VARCHAR(20)   DEFAULT NULL,
  company       VARCHAR(150)  DEFAULT NULL,
  address       TEXT          DEFAULT NULL,
  status        ENUM('lead', 'prospect', 'customer', 'inactive') NOT NULL DEFAULT 'lead',
  source        ENUM('walk-in', 'referral', 'online', 'cold-call', 'other') NOT NULL DEFAULT 'other',
  notes         TEXT          DEFAULT NULL,
  assigned_to   INT           DEFAULT NULL,
  created_by    INT           NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_customers_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_created  FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customer_activities (
  id            INT           NOT NULL AUTO_INCREMENT,
  customer_id   INT           NOT NULL,
  user_id       INT           NOT NULL,
  type          ENUM('call', 'email', 'meeting', 'note', 'follow-up') NOT NULL,
  description   TEXT          NOT NULL,
  activity_date TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ca_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_user     FOREIGN KEY (user_id)     REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  MODULE 2: INVENTORY (Products & Stock)
-- ============================================================

CREATE TABLE categories (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  description TEXT          DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id              INT             NOT NULL AUTO_INCREMENT,
  name            VARCHAR(200)    NOT NULL,
  sku             VARCHAR(100)    NOT NULL,
  category_id     INT             DEFAULT NULL,
  description     TEXT            DEFAULT NULL,
  unit            VARCHAR(50)     NOT NULL DEFAULT 'pcs',
  cost_price      DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  selling_price   DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  stock_qty       DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  min_stock_qty   DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_by      INT             NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_created  FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movements (
  id            INT             NOT NULL AUTO_INCREMENT,
  product_id    INT             NOT NULL,
  type          ENUM('in', 'out', 'adjustment') NOT NULL,
  qty           DECIMAL(12, 2)  NOT NULL,
  reference     VARCHAR(100)    DEFAULT NULL,
  note          TEXT            DEFAULT NULL,
  created_by    INT             NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_sm_user    FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  MODULE 3: SALES (Orders & Invoices)
-- ============================================================

CREATE TABLE sales_orders (
  id              INT             NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(50)     NOT NULL,
  customer_id     INT             DEFAULT NULL,
  status          ENUM('draft', 'confirmed', 'delivered', 'cancelled') NOT NULL DEFAULT 'draft',
  order_date      DATE            NOT NULL,
  delivery_date   DATE            DEFAULT NULL,
  subtotal        DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  discount        DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  tax             DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  total           DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  notes           TEXT            DEFAULT NULL,
  created_by      INT             NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_number (order_number),
  CONSTRAINT fk_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_so_created  FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sales_order_items (
  id              INT             NOT NULL AUTO_INCREMENT,
  order_id        INT             NOT NULL,
  product_id      INT             NOT NULL,
  qty             DECIMAL(12, 2)  NOT NULL,
  unit_price      DECIMAL(12, 2)  NOT NULL,
  discount        DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  total           DECIMAL(12, 2)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_soi_order   FOREIGN KEY (order_id)   REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_soi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
  id              INT             NOT NULL AUTO_INCREMENT,
  invoice_number  VARCHAR(50)     NOT NULL,
  order_id        INT             NOT NULL,
  customer_id     INT             DEFAULT NULL,
  status          ENUM('unpaid', 'partial', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'unpaid',
  issue_date      DATE            NOT NULL,
  due_date        DATE            NOT NULL,
  amount_due      DECIMAL(12, 2)  NOT NULL,
  amount_paid     DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  created_by      INT             NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_number (invoice_number),
  CONSTRAINT fk_inv_order    FOREIGN KEY (order_id)    REFERENCES sales_orders(id),
  CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_created  FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  MODULE 4: ACCOUNTING (Transactions & Reports)
-- ============================================================

CREATE TABLE accounts (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150)  NOT NULL,
  type        ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  code        VARCHAR(20)   NOT NULL,
  description TEXT          DEFAULT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
  id               INT             NOT NULL AUTO_INCREMENT,
  reference        VARCHAR(100)    NOT NULL,
  type             ENUM('income', 'expense', 'transfer') NOT NULL,
  account_id       INT             NOT NULL,
  amount           DECIMAL(12, 2)  NOT NULL,
  description      TEXT            DEFAULT NULL,
  transaction_date DATE            NOT NULL,
  invoice_id       INT             DEFAULT NULL,
  created_by       INT             NOT NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_tx_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_user    FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id              INT             NOT NULL AUTO_INCREMENT,
  invoice_id      INT             NOT NULL,
  amount          DECIMAL(12, 2)  NOT NULL,
  method          ENUM('cash', 'bank_transfer', 'mobile_banking', 'cheque', 'other') NOT NULL DEFAULT 'cash',
  payment_date    DATE            NOT NULL,
  note            TEXT            DEFAULT NULL,
  created_by      INT             NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pay_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user    FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  DEFAULT SEED DATA
-- ============================================================

-- Default users — password for ALL THREE is:  password
INSERT INTO users (name, email, password, role) VALUES
('Admin User',  'admin@hishab.com',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Manager One', 'manager@hishab.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager'),
('Staff One',   'staff@hishab.com',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff');

-- Default chart of accounts
INSERT INTO accounts (name, type, code) VALUES
('Cash',                'asset',     '1001'),
('Bank Account',        'asset',     '1002'),
('Accounts Receivable', 'asset',     '1100'),
('Inventory Asset',     'asset',     '1200'),
('Accounts Payable',    'liability', '2001'),
('Sales Revenue',       'revenue',   '4001'),
('Cost of Goods Sold',  'expense',   '5001'),
('Operating Expenses',  'expense',   '5002'),
('Salary Expense',      'expense',   '5003'),
('Retained Earnings',   'equity',    '3001');

-- Default product categories
INSERT INTO categories (name, description) VALUES
('General',     'General purpose products'),
('Electronics', 'Electronic items and accessories'),
('Stationery',  'Office and stationery supplies'),
('Services',    'Service-based offerings');
