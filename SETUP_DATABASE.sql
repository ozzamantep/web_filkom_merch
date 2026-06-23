-- ==========================================================
-- DATABASE RESET & CREATION
-- ==========================================================
DROP DATABASE IF EXISTS db_filkommerch;
CREATE DATABASE db_filkommerch;
USE db_filkommerch;

-- ==========================================================
-- 1. TABEL USERS (Pengguna / Mahasiswa)
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nim VARCHAR(25) UNIQUE, -- Opsional, bisa null kalau ada pembeli non-mahasiswa
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    role ENUM('admin', 'customer') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================================
-- 2. TABEL CATEGORIES (Kategori Produk)
-- ==========================================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. TABEL PRODUCTS (Katalog Barang Utama)
-- ==========================================================
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    price INT NOT NULL,
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ==========================================================
-- 4. TABEL PRODUCT VARIANTS (Ukuran & Stok)
-- ==========================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    size VARCHAR(10) NOT NULL, -- S, M, L, XL, XXL, All Size
    stock INT NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ==========================================================
-- 5. TABEL ORDERS (Transaksi Induk & Data Midtrans)
-- ==========================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- Ini yang dikirim ke Midtrans (Contoh: FILKOM-17189283)
    order_id VARCHAR(50) NOT NULL UNIQUE, 
    user_id INT NULL, -- Bisa NULL kalau checkout sebagai Guest (tanpa login)
    
    -- Data Pembeli saat transaksi (Snapshot)
    customer_name VARCHAR(100) NOT NULL,
    customer_nim VARCHAR(25),
    customer_email VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    shipping_address TEXT,
    
    -- Angka Finansial
    gross_amount INT NOT NULL, -- Total harga
    
    -- Data MIDTRANS (Diisi saat Callback/Webhook dari Midtrans masuk)
    payment_type VARCHAR(50) NULL, -- qris, bank_transfer, gopay, dll
    transaction_status VARCHAR(20) DEFAULT 'pending', -- pending, settlement, expire, cancel
    midtrans_transaction_id VARCHAR(100) NULL, -- ID Asli dari Midtrans
    snap_token VARCHAR(255) NULL, -- Disimpan agar user bisa lanjut bayar kalau web terclose
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================================
-- 6. TABEL ORDER ITEMS (Detail Keranjang per Transaksi)
-- ==========================================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    product_id INT NULL,
    
    -- Snapshot data barang (Jaga-jaga kalau nama/harga barang berubah di masa depan)
    product_name VARCHAR(150) NOT NULL,
    size VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    price INT NOT NULL,
    subtotal INT NOT NULL,
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ==========================================================
-- OFFLINE POS TABLES (Required for POS / Admin system)
-- ==========================================================
CREATE TABLE IF NOT EXISTS offline_sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id VARCHAR(50) UNIQUE NOT NULL,
  admin_id INT DEFAULT NULL,
  cashier_name VARCHAR(255),
  customer_name VARCHAR(255),
  payment_method VARCHAR(50) NOT NULL,
  subtotal INT NOT NULL,
  discount INT DEFAULT 0,
  tax INT DEFAULT 0,
  total INT NOT NULL,
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
  unit_price INT NOT NULL,
  discount INT DEFAULT 0,
  subtotal INT NOT NULL,
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

-- ==========================================================
-- INSERT DATA DUMMY
-- ==========================================================
INSERT INTO categories (name, slug) VALUES 
('Apparel', 'apparel'),
('Accessories', 'accessories');

INSERT INTO products (id, category_id, name, slug, description, price, image_url) VALUES 
(1, 1, 'Varsity FILKOM Edition', 'varsity-filkom', 'Varsity premium dengan bordir logo FILKOM.', 185000, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400'),
(2, 1, 'Hoodie Code/Run', 'hoodie-code-run', 'Hoodie nyaman untuk ngoding semalaman.', 160000, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400'),
(3, 1, 'T-Shirt Debugging', 'tshirt-debugging', 'Kaos katun adem dengan desain programmer.', 85000, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400'),
(4, 2, 'Lanyard FILKOM Exclusive', 'lanyard-filkom', 'Lanyard untuk ID Card mahasiswa.', 25000, 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&q=80&w=400');

-- Masukkan Stok untuk Varsity
INSERT INTO product_variants (product_id, size, stock) VALUES 
(1, 'S', 10), (1, 'M', 25), (1, 'L', 30), (1, 'XL', 15);

-- Masukkan Stok untuk Hoodie
INSERT INTO product_variants (product_id, size, stock) VALUES 
(2, 'S', 5), (2, 'M', 20), (2, 'L', 20), (2, 'XL', 10);

-- Masukkan Stok untuk T-Shirt
INSERT INTO product_variants (product_id, size, stock) VALUES 
(3, 'S', 15), (3, 'M', 40), (3, 'L', 50), (3, 'XL', 20);

-- Masukkan Stok Lanyard (All Size)
INSERT INTO product_variants (product_id, size, stock) VALUES 
(4, 'All Size', 100);

-- Tambahan data dummy akun admin dan mahasiswa
-- Password untuk semua akun ini di-hash menggunakan Bcrypt, password aslinya adalah: password123
INSERT INTO users (id, name, nim, email, password_hash, phone, address, role) VALUES
(1, 'Admin BEM FILKOM', '20515020000000', 'admin@filkom.ub.ac.id', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '081234567890', 'Gedung BEM FILKOM UB', 'admin'),
(2, 'Ozza Mahasiswa', '23515040000000', 'ozza@student.ub.ac.id', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '089876543210', 'Jl. MT Haryono No. 165, Malang', 'customer');

-- Memasukkan data dummy riwayat pesanan (Orders) dengan simulasi status Midtrans
INSERT INTO orders (order_id, user_id, customer_name, customer_nim, customer_email, customer_phone, shipping_address, gross_amount, payment_type, transaction_status, midtrans_transaction_id) VALUES
('FILKOM-1718900001', 2, 'Ozza Mahasiswa', '23515040000000', 'ozza@student.ub.ac.id', '089876543210', 'Jl. MT Haryono No. 165, Malang', 345000, 'qris', 'settlement', 'xyz123-qris-midtrans'),
('FILKOM-1718900002', NULL, 'Budi Tamu', '24515020000000', 'budi.maba@gmail.com', '08111222333', 'Ambil di Gedung G FILKOM', 85000, 'gopay', 'pending', NULL),
('FILKOM-1718900003', 2, 'Ozza Mahasiswa', '23515040000000', 'ozza@student.ub.ac.id', '089876543210', 'Jl. MT Haryono No. 165, Malang', 160000, 'bank_transfer', 'expire', 'abc987-bca-midtrans');

-- Detail keranjang dari riwayat pesanan
INSERT INTO order_items (order_id, product_id, product_name, size, quantity, price, subtotal) VALUES
('FILKOM-1718900001', 1, 'Varsity FILKOM Edition', 'L', 1, 185000, 185000),
('FILKOM-1718900001', 2, 'Hoodie Code/Run', 'M', 1, 160000, 160000),
('FILKOM-1718900002', 3, 'T-Shirt Debugging', 'XL', 1, 85000, 85000),
('FILKOM-1718900003', 2, 'Hoodie Code/Run', 'L', 1, 160000, 160000);

-- Store Settings dummy
INSERT INTO store_settings (store_name, address, phone, tax_rate) VALUES
('FILKOM Merch', 'Gedung BEM FILKOM UB', '081234567890', 0);
