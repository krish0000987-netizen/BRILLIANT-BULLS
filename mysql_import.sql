-- ============================================================
-- BRILLIANT BULLS — MySQL Import File for MilesWeb
-- Run this in phpMyAdmin or MySQL terminal
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- ------------------------------------------------------------
-- Table: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `username` VARCHAR(255) NOT NULL,
  `password` TEXT NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `first_name` VARCHAR(255) DEFAULT NULL,
  `last_name` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'user',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
  `sid` VARCHAR(255) NOT NULL,
  `sess` JSON NOT NULL,
  `expire` DATETIME NOT NULL,
  PRIMARY KEY (`sid`),
  KEY `IDX_session_expire` (`expire`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: subscriptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `plan` VARCHAR(100) NOT NULL DEFAULT 'trial',
  `status` VARCHAR(50) NOT NULL DEFAULT 'inactive',
  `amount` INT NOT NULL DEFAULT 0,
  `start_date` DATETIME DEFAULT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `trial_started_at` DATETIME DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `subscriptions_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) DEFAULT NULL,
  `action` TEXT NOT NULL,
  `category` TEXT NOT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` TEXT DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `severity` TEXT NOT NULL DEFAULT 'info',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `audit_logs_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: algo_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `algo_logs` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) DEFAULT NULL,
  `run_id` VARCHAR(255) DEFAULT NULL,
  `level` VARCHAR(50) NOT NULL,
  `message` TEXT NOT NULL,
  `logged_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `algo_logs_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: csv_configs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `csv_configs` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `file_name` TEXT NOT NULL,
  `encrypted_content` TEXT NOT NULL,
  `iv` TEXT NOT NULL,
  `auth_tag` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `csv_configs_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: devices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `device_fingerprint` TEXT NOT NULL,
  `browser_name` TEXT DEFAULT NULL,
  `browser_version` TEXT DEFAULT NULL,
  `os_name` TEXT DEFAULT NULL,
  `os_version` TEXT DEFAULT NULL,
  `ip_address` TEXT DEFAULT NULL,
  `country` TEXT DEFAULT NULL,
  `city` TEXT DEFAULT NULL,
  `is_trusted` TINYINT(1) NOT NULL DEFAULT 0,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `devices_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: encrypted_credentials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `encrypted_credentials` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `credential_type` TEXT NOT NULL,
  `encrypted_value` TEXT NOT NULL,
  `iv` TEXT NOT NULL,
  `auth_tag` TEXT NOT NULL,
  `label` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `encrypted_credentials_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Seed: Admin user (akshay / 000999)
-- ------------------------------------------------------------
INSERT IGNORE INTO `users`
  (`id`, `username`, `password`, `role`, `is_active`, `created_at`, `updated_at`)
VALUES (
  '0139a37a-641d-45f6-931c-f83628fa1a8c',
  'akshay',
  '$2b$10$7RZkz2x3WXKjKne.h6/k8OyLTq9//QE.5zbbUuLTLIrghUOTJW/Uu',
  'admin',
  1,
  '2026-03-17 09:18:45',
  '2026-03-17 09:18:45'
);

SET FOREIGN_KEY_CHECKS = 1;

-- Done! All 8 tables created + admin user seeded.
