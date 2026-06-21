-- ============================================
-- FILKOM MERCH DATABASE SETUP
-- ============================================
-- Copy seluruh script ini dan paste di PhpMyAdmin SQL tab

-- Create Database
CREATE DATABASE IF NOT EXISTS db_filkommerch;
USE db_filkommerch;

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  address TEXT,
  role ENUM('admin', 'buyer') DEFAULT 'buyer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: categories
-- ============================================
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: products
-- ============================================
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- ============================================
-- TABLE: product_variants
-- ============================================
CREATE TABLE product_variants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  size VARCHAR(50),
  stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- TABLE: orders
-- ============================================
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INT,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  gross_amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50),
  transaction_status VARCHAR(50) DEFAULT 'pending',
  midtrans_transaction_id VARCHAR(100),
  snap_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- TABLE: order_items
-- ============================================
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(50) NOT NULL,
  product_id INT,
  product_name VARCHAR(255) NOT NULL,
  size VARCHAR(50),
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- INSERT: Sample Categories
-- ============================================
INSERT INTO categories (name, slug, description, is_active) VALUES
('Jackets', 'jackets', 'Varsity and casual jackets', TRUE),
('Hoodies', 'hoodies', 'Comfortable hoodies', TRUE),
('T-Shirts', 't-shirts', 'Quality t-shirts', TRUE),
('Accessories', 'accessories', 'Bags, caps, and more', TRUE);

-- ============================================
-- INSERT: Sample Products
-- ============================================
INSERT INTO products (category_id, name, slug, description, price, is_active) VALUES
(1, 'Varsity Jacket — Filkom ''25', 'varsity-jacket-filkom-25', 'Official varsity jacket for Filkom 2025', 450000, TRUE),
(2, 'Heavyweight Hoodie Navy', 'heavyweight-hoodie-navy', 'Premium navy hoodie', 285000, TRUE),
(3, 'Essential Tee — Navy', 'essential-tee-navy', 'Classic navy t-shirt', 125000, TRUE),
(3, 'Graphic Tee — Forpt Cantcont', 'graphic-tee-forpt', 'Graphic design t-shirt', 145000, TRUE),
(4, 'F Logo Snapback', 'f-logo-snapback', 'Filkom logo snapback cap', 95000, TRUE),
(4, 'Canvas Tote — Logo Stamp', 'canvas-tote-logo', 'Canvas tote bag with logo', 65000, TRUE);

-- ============================================
-- INSERT: Sample Product Variants
-- ============================================
INSERT INTO product_variants (product_id, size, stock) VALUES
(1, 'XS', 10), (1, 'S', 15), (1, 'M', 20), (1, 'L', 18), (1, 'XL', 12), (1, 'XXL', 8),
(2, 'XS', 12), (2, 'S', 18), (2, 'M', 22), (2, 'L', 20), (2, 'XL', 15), (2, 'XXL', 10),
(3, 'XS', 8), (3, 'S', 12), (3, 'M', 15), (3, 'L', 14), (3, 'XL', 10), (3, 'XXL', 5),
(4, 'XS', 7), (4, 'S', 11), (4, 'M', 13), (4, 'L', 12), (4, 'XL', 9), (4, 'XXL', 4),
(5, 'One Size', 50),
(6, 'One Size', 40);

-- ============================================
-- INSERT: Sample Users
-- ============================================
INSERT INTO users (name, email, phone, role) VALUES
('Admin Filkom', 'admin@filkom.com', '08812345678', 'admin'),
('John Doe', 'john@example.com', '08712345678', 'buyer'),
('Jane Smith', 'jane@example.com', '08612345678', 'buyer');

-- Verify
SELECT 'Tables created successfully!' AS status;
SELECT COUNT(*) as product_count FROM products;
SELECT COUNT(*) as variant_count FROM product_variants;
