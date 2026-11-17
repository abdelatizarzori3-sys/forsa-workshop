export const migrations = [{ version: 1, name: "workspace_initial", statements: [
  `CREATE TABLE IF NOT EXISTS forsa_users (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    open_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL DEFAULT '',
    trial_started_at DATETIME(3) NULL, trial_expires_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forsa_clients (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL DEFAULT '',
    phone VARCHAR(60) NOT NULL DEFAULT '', notes TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY forsa_clients_owner_id (owner_id, id),
    CONSTRAINT forsa_clients_owner_fk FOREIGN KEY (owner_id) REFERENCES forsa_users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forsa_offers (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    client_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    title VARCHAR(160) NOT NULL, description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL, cost DECIMAL(12,2) NOT NULL,
    currency ENUM('MAD','SAR','AED','USD','EUR') NOT NULL DEFAULT 'MAD',
    status ENUM('draft','sent','accepted','declined') NOT NULL DEFAULT 'draft',
    valid_until DATE NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY forsa_offers_owner (owner_id), KEY forsa_offers_client (owner_id, client_id),
    CONSTRAINT forsa_offers_owner_fk FOREIGN KEY (owner_id) REFERENCES forsa_users(id) ON DELETE RESTRICT,
    CONSTRAINT forsa_offers_client_fk FOREIGN KEY (owner_id, client_id) REFERENCES forsa_clients(owner_id, id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forsa_brands (
    owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    business_name VARCHAR(120) NOT NULL, contact_email VARCHAR(254) NOT NULL DEFAULT '',
    contact_phone VARCHAR(60) NOT NULL DEFAULT '', logo_data_url MEDIUMTEXT NULL,
    CONSTRAINT forsa_brands_owner_fk FOREIGN KEY (owner_id) REFERENCES forsa_users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
] }, { version: 2, name: "durable_oauth_nonce", statements: [
  `CREATE TABLE IF NOT EXISTS forsa_oauth_nonces (
    nonce_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    redirect_uri VARCHAR(2048) NOT NULL, expires_at DATETIME(3) NOT NULL,
    KEY forsa_nonce_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
] }] as const;
