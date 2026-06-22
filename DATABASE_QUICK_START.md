# 🗄️ Database Integration Setup Guide

## Ringkas: Step-by-Step Setup

### 1️⃣ **Setup Database di Laragon**

**Pastikan Laragon sudah running** (Apache + MySQL hijau)

1. Buka **http://localhost/phpmyadmin**
2. Login: `root` / kosong
3. Klik tab **SQL**
4. Copy-paste SQL script dari file `DATABASE_SETUP.md`
5. Klik **Go**

✅ Database `db_filkommerch` sudah siap dengan semua tables

---

### 2️⃣ **Setup Environment Variables**

Buat file `.env.local` di root project:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_filkommerch
DB_PORT=3306
MIDTRANS_SERVER_KEY=YOUR_MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY=YOUR_MIDTRANS_SERVER_KEY
VITE_API_URL=http://localhost:5173/api
```

---

### 3️⃣ **Install MySQL Driver**

```bash
npm install mysql2
```

---

### 4️⃣ **Start Dev Server**

```bash
npm run dev
```

---

## ✅ Verify Setup

### Test 1: Database Connection

```bash
# Check di browser console:
# Jika ada error tentang database, verify .env.local
```

### Test 2: Fetch Products

```
Browser: http://localhost:5173/api/products
Seharusnya return JSON array dari database
```

### Test 3: Create Order

1. Add produk ke cart
2. Checkout sampai Step 3
3. Klik "Generate QR Code"
4. Check PhpMyAdmin:
   - Table `orders` → ada 1 row
   - Table `order_items` → ada items

---

## 📊 Database Schema

```
db_filkommerch/
├── users          # Akun pengguna
├── categories     # Kategori produk
├── products       # Data produk
├── product_variants # Ukuran & stok
├── orders         # Transaksi
└── order_items    # Detail transaksi
```

---

## 🔧 Integration Details

### Frontend → Backend Flow:

```
HomePage:
  1. GET /api/products → DB products
  2. Display produk dari database

Add to Cart:
  - Save ke localStorage (local)

Checkout:
  1. POST /api/checkout/create-order
  2. Backend INSERT ke DB orders & order_items
  3. Backend call Midtrans API
  4. Return QRIS token
  5. Frontend tampil QR code

Payment Webhook (future):
  - Midtrans → /api/webhook
  - Update order status di DB
```

---

## 📝 Data yang Disimpan di Database

### Saat Checkout:

**Table `orders`:**

- order_id: `FILKOM-1718928324`
- customer_name, email, phone
- gross_amount: total harga
- transaction_status: pending/settlement/cancel
- snap_token: untuk retry pembayaran

**Table `order_items`:**

- Per item yang dibeli
- product_name, size, quantity, price
- subtotal = price × quantity

---

## 🐛 Troubleshooting

### ❌ Error: "Can't connect to MySQL"

```
✅ Solution:
1. Check Laragon running
2. Verify .env.local: DB_HOST=localhost, DB_USER=root
3. Test di PhpMyAdmin
```

### ❌ Error: "Unknown database"

```
✅ Solution:
1. Run SQL script di PhpMyAdmin
2. Check .env.local: DB_NAME=db_filkommerch (case-sensitive)
```

### ❌ Error: "mysql2 not found"

```bash
✅ Solution:
npm install mysql2
npm run dev
```

### ❌ Order tidak terinsert

```
✅ Check:
1. Buka PhpMyAdmin table orders
2. Check browser console error
3. Verify order_id unique (tidak duplicate)
```

---

## 📚 Files Created/Modified

```
src/
├── lib/
│   ├── database.ts          # NEW - Database connection
│   ├── config.ts            # NEW - Config management
│   └── midtrans.ts          # UPDATED - Config dari env
├── routes/
│   ├── api/
│   │   ├── products.ts      # NEW - Product endpoints
│   │   ├── orders.ts        # NEW - Order endpoints
│   │   └── checkout.ts      # UPDATED - Order creation
│   ├── checkout.tsx         # UPDATED - Use server function
│   └── index.tsx            # READY for products

.env.local                    # NEW - Environment variables
.env.local.example            # Template
DATABASE_SETUP.md             # SQL script
DATABASE_INTEGRATION.md       # Setup guide
```

---

## ✨ Next Features (TODO)

- [ ] Fetch products dari database di homepage
- [ ] Admin dashboard untuk manage products
- [ ] User profile & order history
- [ ] Payment webhook untuk update status
- [ ] Email notification saat payment
- [ ] Stock management & reduction

---

## 🚀 Production Checklist

- [ ] Update Midtrans credentials ke production
- [ ] Change `isProduction: true` di config
- [ ] Setup webhook endpoint untuk notifications
- [ ] Add HTTPS untuk production
- [ ] Backup database setup
- [ ] Test payment dengan real cards

---

Siap deploy! 🎉
