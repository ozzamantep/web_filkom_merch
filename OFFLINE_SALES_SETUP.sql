-- Offline POS sales tables (run after SETUP_DATABASE.sql)
USE db_filkommerch;

CREATE TABLE IF NOT EXISTS offline_sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id VARCHAR(50) UNIQUE NOT NULL,
  admin_id INT DEFAULT NULL,
  cashier_name VARCHAR(255),
  customer_name VARCHAR(255),
  payment_method VARCHAR(50) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  source ENUM('offline') DEFAULT 'offline',
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offline_sale_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_id INT DEFAULT NULL,
  size VARCHAR(50),
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES offline_sales(sale_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_name VARCHAR(255) DEFAULT 'FILKOM Merch',
  address TEXT,
  phone VARCHAR(20),
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  qris_static_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO store_settings (store_name, address, phone, tax_rate)
SELECT 'FILKOM Merch', 'Fakultas Ilmu Komputer, UB', '08812345678', 0
WHERE NOT EXISTS (SELECT 1 FROM store_settings LIMIT 1);
