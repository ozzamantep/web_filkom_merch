-- ===================================
-- ADMIN & SALES MANAGEMENT SCHEMA
-- ===================================

USE db_filkommerch;

-- 1. ADMIN USERS TABLE - Add columns if they don't exist
DELIMITER $$

CREATE PROCEDURE add_role_column()
BEGIN
  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_name = 'users' 
    AND column_name = 'role'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    ALTER TABLE users ADD COLUMN role ENUM('admin', 'buyer') DEFAULT 'buyer';
  END IF;
END$$

CREATE PROCEDURE add_permissions_column()
BEGIN
  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_name = 'users' 
    AND column_name = 'permissions'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    ALTER TABLE users ADD COLUMN permissions JSON;
  END IF;
END$$

DELIMITER ;

CALL add_role_column();
CALL add_permissions_column();

DROP PROCEDURE add_role_column;
DROP PROCEDURE add_permissions_column;

-- 2. PAYMENT METHODS TABLE
CREATE TABLE IF NOT EXISTS payment_methods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO payment_methods (id, code, name, description) VALUES
(1, 'cash', 'Cash / Tunai', 'Pembayaran tunai langsung'),
(2, 'debit', 'Debit Card', 'Pembayaran dengan kartu debit'),
(3, 'credit', 'Credit Card', 'Pembayaran dengan kartu kredit'),
(4, 'transfer', 'Bank Transfer', 'Transfer bank online'),
(5, 'e_wallet', 'E-Wallet', 'GCash, OVO, DANA, dll'),
(6, 'qris', 'QRIS', 'Pembayaran QRIS');

-- 3. SALES/TRANSACTIONS TABLE (untuk offline store)
CREATE TABLE IF NOT EXISTS sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id VARCHAR(50) UNIQUE NOT NULL,
  admin_id INT,
  payment_method_id INT NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  discount DECIMAL(12, 2) DEFAULT 0,
  tax DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  status ENUM('completed', 'cancelled', 'pending') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  INDEX idx_admin (admin_id),
  INDEX idx_created (created_at),
  INDEX idx_status (status)
);

-- 4. SALES ITEMS TABLE
CREATE TABLE IF NOT EXISTS sale_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  product_id INT,
  product_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  discount DECIMAL(12, 2) DEFAULT 0,
  subtotal DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_sale (sale_id)
);

-- 5. STOCK/INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL UNIQUE,
  stock INT DEFAULT 0,
  min_stock INT DEFAULT 5,
  last_restock_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_stock (stock),
  INDEX idx_product (product_id)
);

-- 6. STOCK HISTORY TABLE (audit trail)
CREATE TABLE IF NOT EXISTS stock_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  type ENUM('in', 'out', 'adjustment') NOT NULL,
  quantity INT NOT NULL,
  reference_id VARCHAR(50),
  reference_type VARCHAR(50),
  notes TEXT,
  admin_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (admin_id) REFERENCES users(id),
  INDEX idx_product (product_id),
  INDEX idx_type (type),
  INDEX idx_created (created_at)
);

-- 7. PRINTER CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS printer_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  printer_name VARCHAR(100),
  printer_mac_address VARCHAR(50),
  printer_type ENUM('thermal', 'inkjet') DEFAULT 'thermal',
  printer_brand VARCHAR(50),
  paper_width INT DEFAULT 80,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_admin (admin_id),
  INDEX idx_mac (printer_mac_address)
);

-- 8. SALES SUMMARY VIEW (untuk dashboard)
CREATE OR REPLACE VIEW sales_summary AS
SELECT 
  DATE(s.created_at) as sale_date,
  COUNT(s.id) as total_transactions,
  COUNT(DISTINCT s.admin_id) as num_cashiers,
  SUM(s.total) as total_revenue,
  SUM(s.discount) as total_discount,
  AVG(s.total) as avg_transaction,
  pm.name as payment_method,
  s.status
FROM sales s
LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
WHERE s.status = 'completed'
GROUP BY DATE(s.created_at), pm.name, s.status;

-- 9. PRODUCT SALES SUMMARY VIEW
CREATE OR REPLACE VIEW product_sales_summary AS
SELECT 
  p.id,
  p.name,
  p.price,
  COUNT(si.id) as times_sold,
  SUM(si.quantity) as total_quantity_sold,
  SUM(si.subtotal) as total_revenue
FROM products p
LEFT JOIN sale_items si ON p.id = si.product_id
LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
GROUP BY p.id, p.name, p.price
ORDER BY total_quantity_sold DESC;

-- 10. INSERT DEFAULT INVENTORY FOR EXISTING PRODUCTS
INSERT IGNORE INTO inventory (product_id, stock, min_stock)
SELECT id, 10, 5 FROM products WHERE id NOT IN (SELECT product_id FROM inventory);

-- 11. CREATE INDEX FOR PERFORMANCE
DELIMITER $$

CREATE PROCEDURE create_indexes()
BEGIN
  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_name = 'sales' 
    AND index_name = 'idx_sales_date'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    CREATE INDEX idx_sales_date ON sales(created_at DESC);
  END IF;

  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_name = 'sales' 
    AND index_name = 'idx_sales_total'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    CREATE INDEX idx_sales_total ON sales(total);
  END IF;

  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_name = 'sale_items' 
    AND index_name = 'idx_sale_items_sale'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
  END IF;
END$$

DELIMITER ;

CALL create_indexes();
DROP PROCEDURE create_indexes;

-- ===================================
-- REAL-TIME STOCK SYNC SCHEMA
-- ===================================

-- 12. ADD stock_reduced COLUMN TO orders TABLE (if not exists)
DELIMITER $$

CREATE PROCEDURE add_stock_reduced_column()
BEGIN
  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_name = 'orders' 
    AND column_name = 'stock_reduced'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    ALTER TABLE orders ADD COLUMN stock_reduced BOOLEAN DEFAULT FALSE;
    CREATE INDEX idx_orders_stock_reduced ON orders(stock_reduced);
  END IF;
END$$

DELIMITER ;

CALL add_stock_reduced_column();
DROP PROCEDURE add_stock_reduced_column;

-- 13. STOCK RESERVATIONS TABLE (untuk prevent overbooking)
CREATE TABLE IF NOT EXISTS stock_reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  size VARCHAR(50),
  quantity INT NOT NULL,
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  status ENUM('active', 'completed', 'expired', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order (order_id),
  INDEX idx_product (product_id),
  INDEX idx_status (status),
  INDEX idx_expires (expires_at)
);

-- 14. SYNC LOGS TABLE (untuk tracking dan debugging)
CREATE TABLE IF NOT EXISTS sync_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sync_type ENUM('webhook', 'polling', 'manual', 'error') NOT NULL,
  order_id VARCHAR(50),
  product_id INT,
  quantity INT,
  status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
  error_message TEXT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order (order_id),
  INDEX idx_type (sync_type),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- 15. COMBINED SALES VIEW (online + offline)
CREATE OR REPLACE VIEW combined_sales_daily AS
SELECT 
  DATE(s.created_at) as sale_date,
  'offline' as channel,
  COUNT(s.id) as transaction_count,
  SUM(s.total) as total_revenue,
  SUM(s.discount) as total_discount,
  SUM(s.tax) as total_tax,
  AVG(s.total) as avg_transaction,
  SUM(s.subtotal) as subtotal,
  pm.name as payment_method,
  COUNT(DISTINCT s.admin_id) as num_cashiers
FROM sales s
LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
WHERE s.status = 'completed'
GROUP BY DATE(s.created_at), pm.name, s.status

UNION ALL

SELECT 
  DATE(o.created_at) as sale_date,
  'online' as channel,
  COUNT(DISTINCT o.id) as transaction_count,
  SUM(o.gross_amount) as total_revenue,
  0 as total_discount,
  0 as total_tax,
  AVG(o.gross_amount) as avg_transaction,
  SUM(o.gross_amount) as subtotal,
  COALESCE(o.payment_type, 'unknown') as payment_method,
  0 as num_cashiers
FROM orders o
WHERE o.transaction_status = 'settlement' OR o.transaction_status = 'success'
GROUP BY DATE(o.created_at), o.payment_type;

-- 16. CREATE INDEX FOR COMBINED SALES PERFORMANCE
DELIMITER $$

CREATE PROCEDURE create_sync_indexes()
BEGIN
  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_name = 'stock_reservations' 
    AND index_name = 'idx_res_order'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    CREATE INDEX idx_res_order ON stock_reservations(order_id);
  END IF;

  IF NOT EXISTS(
    SELECT NULL FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_name = 'sync_logs' 
    AND index_name = 'idx_logs_order'
    AND table_schema = 'db_filkommerch'
  )
  THEN
    CREATE INDEX idx_logs_order ON sync_logs(order_id);
  END IF;
END$$

DELIMITER ;

CALL create_sync_indexes();
DROP PROCEDURE create_sync_indexes;
