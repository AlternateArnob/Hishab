-- ============================================================
--  HISHAB ERP — Activity Analytics Migration
--  Run after schema.sql to add personal insights tables
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS user_analytics_summary;
DROP TABLE IF EXISTS user_history;

-- ============================================================
--  user_history — raw event log per user
-- ============================================================
CREATE TABLE user_history (
  id             BIGINT        NOT NULL AUTO_INCREMENT,
  user_id        INT           NOT NULL,
  action_type    ENUM('view','create','edit','delete','login','export','report') NOT NULL DEFAULT 'view',
  section        VARCHAR(100)  NOT NULL,         -- e.g. 'crm', 'sales', 'inventory'
  item_id        VARCHAR(100)  DEFAULT NULL,     -- optional entity id acted upon
  item_label     VARCHAR(255)  DEFAULT NULL,     -- human label, e.g. customer name
  api_method     VARCHAR(10)   DEFAULT NULL,     -- GET / POST / PUT / DELETE / PATCH
  api_path       VARCHAR(300)  DEFAULT NULL,
  status         ENUM('success','error')  NOT NULL DEFAULT 'success',
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_uh_user     (user_id),
  KEY idx_uh_date     (created_at),
  KEY idx_uh_section  (section),
  KEY idx_uh_action   (action_type),
  CONSTRAINT fk_uh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  user_analytics_summary — pre-aggregated cache per period
-- ============================================================
CREATE TABLE user_analytics_summary (
  id                      INT           NOT NULL AUTO_INCREMENT,
  user_id                 INT           NOT NULL,
  period                  VARCHAR(7)    NOT NULL,   -- e.g. '2026-06'
  total_actions           INT           NOT NULL DEFAULT 0,
  successful_actions      INT           NOT NULL DEFAULT 0,
  failed_actions          INT           NOT NULL DEFAULT 0,
  most_common_action      VARCHAR(50)   DEFAULT NULL,
  most_visited_section    VARCHAR(100)  DEFAULT NULL,
  unique_items_interacted INT           NOT NULL DEFAULT 0,
  active_days             INT           NOT NULL DEFAULT 0,
  peak_hour               TINYINT       DEFAULT NULL,   -- 0-23
  last_calculated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_uas_user_period (user_id, period),
  KEY idx_uas_user (user_id),
  CONSTRAINT fk_uas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
