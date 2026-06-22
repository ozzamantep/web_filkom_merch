# Checkout dengan Midtrans Sandbox

Fitur checkout Filkom Merch UB sudah terintegrasi dengan Midtrans payment gateway. Saat ini menggunakan **sandbox credentials** untuk testing.

## Setup & Konfigurasi

### Credentials Sandbox

```
Merchant ID: M934219320
Client Key: YOUR_MIDTRANS_SERVER_KEY
Server Key: YOUR_MIDTRANS_SERVER_KEY
```

### Files yang dibuat:

- `src/lib/midtrans.ts` - Konfigurasi dan type definitions
- `src/routes/api/checkout.ts` - API endpoint untuk create transaction
- `src/routes/checkout.tsx` - Halaman checkout (3-step process)
- `src/routes/order-confirmation.tsx` - Halaman konfirmasi order
- `src/hooks/use-cart.ts` - Cart management hook
- `src/components/cart-button.tsx` - Cart button component

## Flow Checkout

### Step 1: Review Cart

- Lihat semua item di cart
- Bisa ubah quantity atau hapus item

### Step 2: Customer Details

- Masukkan nama, email, dan no. telepon
- Validasi otomatis

### Step 3: Payment

- Review semua detail order
- Klik "Pay Now" untuk mulai pembayaran
- Midtrans Snap modal akan terbuka

## Testing dengan Sandbox

### Test Card Credentials:

```
Card Number: 4811 1111 1111 1114
Exp Date: 12/25
CVV: 123
```

### Test Flows:

1. **Sukses**: Ketik "000000" di OTP field
2. **Failed**: Ketik angka apapun selain "000000"
3. **Pending**: Klik "Pending" button

## Cara Menggunakan

### 1. Add to Cart dari Homepage

- Browse produk di homepage
- Klik tombol "ADD TO BAG"
- Lihat cart count di header terupdate

### 2. Buka Cart Drawer

- Klik shopping bag icon di header
- Review items, ubah quantity jika perlu
- Klik "CHECKOUT"

### 3. Complete Checkout

- Step 1: Review cart items
- Step 2: Isi customer details
- Step 3: Review dan bayar dengan Midtrans

## Integrasi Midtrans

### API Endpoint

**POST /api/checkout**

Request body:

```typescript
{
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: CartItem[];
}
```

Response:

```typescript
{
  token: string;
  redirect_url: string;
}
```

### Client-side Integration

- Midtrans Snap script di-load di checkout page
- menggunakan `window.snap.pay(token, callbacks)`
- Callbacks: onSuccess, onPending, onError, onClose

## Perubahan di Production

Ketika ready untuk production:

1. Update credentials di `src/lib/midtrans.ts`:

```typescript
export const MIDTRANS_CONFIG = {
  isProduction: true, // Change to true
  clientKey: "YOUR_PROD_CLIENT_KEY",
  serverKey: "YOUR_PROD_SERVER_KEY",
  merchantId: "YOUR_PROD_MERCHANT_ID",
  snapUrl: "https://app.midtrans.com/snap/snap.js", // Update URL
};
```

2. Test dengan production cards
3. Setup payment notification webhook (untuk update status di database)

## Troubleshooting

### Snap tidak muncul?

- Pastikan Midtrans Snap script sudah loaded
- Check browser console untuk errors
- Verify client key di script tag

### API error?

- Check server key di environment
- Verify transaction payload
- Lihat response dari Midtrans API

### Cart tidak tersimpan?

- Check localStorage di browser
- Verify JSON structure
- Clear browser cache jika perlu

## Next Steps

- [ ] Setup database untuk store transactions
- [ ] Create webhook endpoint untuk payment notifications
- [ ] Add email notification untuk payment success
- [ ] Add payment status tracking page
- [ ] Setup production Midtrans credentials
- [ ] Add refund handling
- [ ] Add payment method selection (jika perlu)
