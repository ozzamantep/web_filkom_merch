# Database Configuration untuk Laragon MySQL

## Setup Laragon MySQL

1. **Pastikan Laragon running:**
   - Buka Laragon
   - Klik "Start All"

2. **Akses PhpMyAdmin:**
   - Buka browser ke: http://localhost/phpmyadmin
   - Username: root
   - Password: (kosong/blank)

3. **Buat Database:**
   - Copy seluruh SQL script ke PhpMyAdmin
   - Buka tab "SQL"
   - Paste script
   - Klik "Go"

4. **Verify Database:**
   ```
   Database: db_filkommerch
   Tables: users, categories, products, product_variants, orders, order_items
   ```

## Environment Variables

File `.env.local` (create di root project):

```
VITE_API_URL=http://localhost:5173/api
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_filkommerch
DB_PORT=3306
MIDTRANS_SERVER_KEY=YOUR_MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY=YOUR_MIDTRANS_SERVER_KEY
```

## Testing Connection

Setelah setup, test dengan:

1. `npm run dev`
2. Buka http://localhost:5173/api/products
3. Harus tampil list products dari database
