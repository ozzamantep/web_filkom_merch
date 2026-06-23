# 🔐 Admin System Setup Guide

## Overview
Sistem admin lengkap untuk Filkom Merch dengan:
- **POS/Kasir** untuk offline store
- **Dashboard** dengan sales analytics
- **Inventory Management**
- **Bluetooth Thermal Printer** integration
- **Multi-payment methods**

---

## 📋 Login Credentials

### Admin Login
- **Username**: `adminfm`
- **Password**: `Filkommerch123_wkwk`
- **Redirect**: `/admin/dashboard`

### Buyer (Google OAuth)
- **Redirect**: `/` (home page)

---

## 🛠️ Database Setup

### 1. Run SQL Script
```bash
# Gunakan MySQL CLI atau client favorit
mysql -u root -p db_filkommerch < ADMIN_SETUP.sql

# Atau manual, copy-paste content dari ADMIN_SETUP.sql ke MySQL client
```

### 2. Tables Created
```
- payment_methods      (Metode pembayaran)
- sales                (Transaksi/penjualan)
- sale_items           (Item dalam transaksi)
- inventory            (Stock produk)
- stock_history        (Audit trail stock)
- printer_config       (Konfigurasi printer Bluetooth)
```

### 3. Views Created
```
- sales_summary        (Ringkasan penjualan harian)
- product_sales_summary (Ringkasan penjualan per produk)
```

---

## 🎨 Admin Routes

### `/admin/dashboard` 
Dashboard utama dengan:
- 📊 KPI Cards (Revenue, Transactions, Discounts, Low Stock)
- 📈 Sales Trends (30 hari)
- 🏆 Top 10 Products
- 📦 Inventory Management

### `/admin/kasir`
Point of Sale System dengan:
- 🔍 Product search & add to cart
- 🛒 Shopping cart management
- 💰 Payment processing
- 🖨️ Bluetooth printer integration
- 🧾 Receipt printing
- 💳 Multiple payment methods (Cash, Card, E-wallet, Transfer, QRIS)

---

## 💻 Features

### 1. POS/Kasir System
```typescript
// File: src/components/pos-kasir.tsx

Features:
✅ Product search & filter
✅ Add/remove items dari cart
✅ Quantity adjustment
✅ Discount per item atau total
✅ Multiple payment methods
✅ Customer name input
✅ Real-time total calculation
```

### 2. Bluetooth Thermal Printer
```typescript
// File: src/lib/bluetooth-printer.ts

Supported:
✅ Thermal printer (Shark, Epson, dll)
✅ Web Bluetooth API
✅ ESC/POS commands
✅ Receipt formatting
✅ Auto-connection management

Device Support:
- Shark thermal printer
- Generic thermal printers via SPP (Serial Port Profile)
```

### 3. Sales Management
```typescript
// File: src/lib/admin-actions.ts

Functions:
✅ createSale()           - Buat transaksi baru
✅ getSalesByDateRange()  - Laporan per range tanggal
✅ getDailySalesSummary() - Ringkasan harian
✅ getTopProducts()       - Produk terlaris
```

### 4. Inventory Management
```
Features:
✅ Real-time stock tracking
✅ Low stock alerts
✅ Manual stock adjustment
✅ Stock history/audit trail
✅ Min stock configuration
```

---

## 🔗 Bluetooth Printer Setup

### Hardware Requirements
- Thermal printer dengan Bluetooth (misal: Shark)
- Mobile device atau laptop dengan Bluetooth support
- Browser yang support Web Bluetooth API (Chrome, Edge, Opera)

### Steps
```
1. Turn on printer & ensure Bluetooth is enabled
2. Pair printer dengan computer di System Settings
3. Di aplikasi:
   - Klik "Connect Printer" button
   - Browser akan tampilkan list Bluetooth devices
   - Select printer → Connect
4. Klik "Test Print" untuk verify
5. Ready to print!
```

### Supported Printers
```
✅ SHARK Bluetooth Thermal Printer
✅ Epson TM series
✅ Any thermal printer dengan SPP support
```

---

## 📱 Payment Methods

Database sudah include:
```
1. Cash / Tunai
2. Debit Card
3. Credit Card
4. Bank Transfer
5. E-Wallet (GCash, OVO, DANA, etc)
6. QRIS
```

Bisa tambah lebih banyak di `payment_methods` table.

---

## 📊 Admin Actions API

### Create Sale
```typescript
await createSale({
  admin_id: 1,
  payment_method_id: 1, // Cash
  items: [
    {
      product_id: 1,
      product_name: "Varsity Jacket",
      quantity: 1,
      unit_price: 450000,
      discount: 0
    }
  ],
  subtotal: 450000,
  discount: 0,
  tax: 45000,
  total: 495000
});
```

### Get Inventory
```typescript
const { inventory } = await getInventory();
// Returns: InventoryItem[]
// Fields: id, product_id, product_name, stock, min_stock, status
```

### Update Stock
```typescript
await updateStock(
  productId: 1,
  quantity: 10,
  type: 'in', // 'in' atau 'adjustment'
  adminId: 1,
  notes: 'Restock dari supplier'
);
```

---

## 🔐 Security

### Admin Access Control
```typescript
// Protect admin routes
if (!user || user.type !== "admin") {
  navigate({ to: "/login" });
}
```

### Password Storage
- Current: Hardcoded (development only)
- Production: Implement proper authentication
  - Hash passwords dengan bcrypt
  - JWT tokens
  - Session management
  - Rate limiting

---

## 📈 Charts & Analytics

### Implemented
- Line chart untuk revenue trend
- Bar chart untuk top products
- Status pie chart untuk inventory

### Using
- Recharts library (sudah di dependencies)

---

## 🚀 Deployment Checklist

```
□ Update hardcoded password (admin)
□ Setup proper authentication system
□ Configure Bluetooth printer for production devices
□ Test all payment methods
□ Verify database connections
□ Setup error logging
□ Test receipt printing
□ Backup database regularly
□ Setup HTTPS for payment security
```

---

## 📝 Troubleshooting

### Bluetooth Printer Issues
```
Problem: "Bluetooth tidak didukung"
Solution: Use Chrome/Edge browser, enable Bluetooth

Problem: "Printer tidak ditemukan"
Solution: Ensure printer is turned on, paired, dan discoverable

Problem: "Print gagal"
Solution: Reconnect printer, test print, check paper
```

### Database Issues
```
Problem: "ADMIN_SETUP.sql error"
Solution: Ensure MySQL running, database exists, proper permissions

Problem: "Tables not created"
Solution: Run script with admin user, check MySQL errors
```

---

## 📚 Files Created

```
Database:
- ADMIN_SETUP.sql                    SQL schema & views

Backend:
- src/lib/admin-actions.ts           Server functions untuk admin
- src/lib/bluetooth-printer.ts       Bluetooth printer utility

Frontend:
- src/components/pos-kasir.tsx       POS/Kasir UI component
- src/routes/admin/dashboard.tsx     Admin dashboard page
- src/routes/admin/kasir.tsx         Kasir page
- src/lib/auth.tsx                   Updated dengan admin user type
- src/routes/login.tsx               Updated redirects
```

---

## 🎯 Next Steps

### Phase 2 (Planned)
- [ ] Proper user authentication (JWT)
- [ ] Admin user management
- [ ] More analytics (profit, expenses)
- [ ] Export to Excel/PDF
- [ ] Mobile app untuk cashier
- [ ] Refund/return processing
- [ ] Multi-register support
- [ ] Cash drawer integration

---

## 📞 Support

For issues atau questions tentang admin system:
1. Check troubleshooting section
2. Review database schema di ADMIN_SETUP.sql
3. Check browser console untuk error messages
4. Verify Bluetooth printer compatibility

---

**Last Updated**: 2026-06-22
**Version**: 1.0
