# Database Integration Setup Guide

## 1. Setup Laragon MySQL Database

### Step 1: Run SQL Script

1. Buka **http://localhost/phpmyadmin** (Laragon harus running)
2. Login dengan:
   - Username: `root`
   - Password: (kosong/blank)
3. Klik tab **SQL**
4. Copy seluruh script dari file `DATABASE_SETUP.md`
5. Paste ke text area
6. Klik **"Go"** untuk execute

### Step 2: Verify Database

```sql
USE db_filkommerch;
SHOW TABLES;
-- Seharusnya ada 6 tabel: users, categories, products, product_variants, orders, order_items
```

---

## 2. Setup Environment Variables

Buat file `.env.local` di root project dengan content:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_filkommerch
DB_PORT=3306

# Midtrans Configuration
MIDTRANS_SERVER_KEY=YOUR_MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY=YOUR_MIDTRANS_SERVER_KEY

# API URL
VITE_API_URL=http://localhost:5173/api
```

### Penjelasan Variables:

- `DB_HOST`: Server MySQL (localhost untuk Laragon)
- `DB_USER`: User MySQL (default root di Laragon)
- `DB_PASSWORD`: Password MySQL (kosong untuk Laragon default)
- `DB_NAME`: Nama database (sesuai script: db_filkommerch)
- `DB_PORT`: Port MySQL (default 3306)
- `MIDTRANS_SERVER_KEY`: Server key Midtrans untuk backend
- `MIDTRANS_CLIENT_KEY`: Client key Midtrans untuk frontend

---

## 3. Install Dependencies

```bash
# Install MySQL driver
npm install mysql2

# Run dev server
npm run dev
```

---

## 4. Test Database Connection

### Test 1: Fetch Products

Buka di browser:

```
http://localhost:5173/api/products
```

Seharusnya return JSON array dengan products dari database.

### Test 2: Buat Order

Saat checkout:

1. Add produk ke cart
2. Checkout sampai step 3
3. Klik "Generate QR Code"
4. Check PhpMyAdmin table `orders` - order seharusnya terinsert
5. Check table `order_items` - items seharusnya terinsert

---

## 5. Database Schema

```
db_filkommerch/
├── users (user accounts)
├── categories (product categories)
├── products (main products)
├── product_variants (sizes & stock)
├── orders (transactions)
└── order_items (order details)
```

---

## Troubleshooting

### Error: "Can't connect to MySQL"

- [ ] Pastikan Laragon running (Apache + MySQL hijau)
- [ ] Check DB_HOST, DB_USER, DB_PASSWORD di .env.local
- [ ] Test connection di PhpMyAdmin

### Error: "Unknown database"

- [ ] Check nama database di .env.local (harus `db_filkommerch`)
- [ ] Run SQL script lagi di PhpMyAdmin
- [ ] Check spelling (case-sensitive)

### Error: "mysql2 not found"

```bash
npm install mysql2
npm run dev
```

### Orders tidak terinsert saat checkout

- [ ] Check database connection dengan buka PhpMyAdmin
- [ ] Check console error di browser
- [ ] Verify order_id tidak duplicate

---

## Next Steps

Setelah berhasil:

1. ✅ Products muncul dari database
2. ✅ Orders terinsert saat checkout
3. ⏭️ Setup webhook Midtrans untuk update payment status
4. ⏭️ Add user profile & order history
5. ⏭️ Add admin dashboard untuk manage products
