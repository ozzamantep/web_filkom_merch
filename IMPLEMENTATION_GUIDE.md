# Real-Time Stock Synchronization - Implementation Guide

## 🎯 Overview

This implementation enables **real-time stock synchronization** between your online buyer website and offline POS (Kasir) system. When customers buy online or offline, stock is automatically reduced in real-time across both channels, preventing overbooking and keeping your inventory accurate.

**Key Features:**
- ✅ Real-time stock updates (webhook + polling)
- ✅ Overbooking prevention (first-come-first-served)
- ✅ 10-minute stock reservation during checkout
- ✅ Unified financial reports (online + offline)
- ✅ Error logging & monitoring
- ✅ Automatic fallback sync (if webhook fails)

---

## 📋 What Was Implemented

### 1. Database Schema Updates (ADMIN_SETUP.sql)
New tables and columns added to `db_filkommerch`:

```sql
-- Stock reservation table (prevents overbooking)
stock_reservations (id, order_id, product_id, size, quantity, expires_at, status)

-- Sync operation logging (for debugging)
sync_logs (id, sync_type, order_id, product_id, status, error_message, created_at)

-- New column in orders table
orders.stock_reduced (BOOLEAN) -- marks if stock was reduced

-- New VIEW for combined sales
combined_sales_daily (aggregates online + offline)
```

**Status:** Applied to MySQL database ✅

### 2. Stock Reservation System (src/lib/admin-actions.ts)
**New Functions:**
- `checkStockAvailability()` — Check if stock is available (considers active reservations)
- `reserveStock()` — Reserve stock for 10 minutes during checkout
- `completeReservation()` — Reduce actual inventory when payment succeeds
- `releaseReservation()` — Cancel reservation if checkout abandoned
- `expireOldReservations()` — Automatically expire 10+ minute old reservations
- `getOrderReservations()` — View reservations for an order

**Example Usage:**
```typescript
// Check if stock available (after considering reservations)
const check = await checkStockAvailability(productId=1, requestedQty=5);
if (!check.available) {
  throw new Error(`Only ${check.availableStock} available`);
}

// Reserve stock when checkout starts
const reserve = await reserveStock(orderId="ORD-123", items=[
  { product_id: 1, quantity: 5, size: "M" }
]);

// Complete reservation when payment succeeds (webhook calls this)
await completeReservation(orderId="ORD-123");
```

### 3. Midtrans Webhook Endpoint (src/routes/api/-webhook.ts)
**POST /api/webhook/midtrans** — Receives payment confirmations from Midtrans

**What it does:**
1. Verifies webhook signature (HMAC-SHA512) for security
2. When payment succeeds (`transaction_status='settlement'`):
   - Reduces stock from inventory table
   - Logs to stock_history (reference_type='online')
   - Marks order as `stock_reduced=TRUE`
   - Completes associated reservation
3. When payment fails (`transaction_status='cancel'|'expire'`):
   - Cancels stock reservation
   - Frees stock back up
4. Logs all operations to sync_logs for auditing

**Security:** Signature verification prevents spoofing

### 4. Polling Fallback Job (src/lib/stock-sync-job.ts)
**Purpose:** Catch orders where webhook failed

**Functions:**
- `syncStockFromPendingOrders()` — Finds orders where payment succeeded but stock not reduced
- `expireOldStockReservations()` — Expires reservations older than expiry time
- `checkStockDiscrepancies()` — Identifies orphaned orders

**Integration:** Can be triggered manually or run on schedule (every 5 minutes recommended)

### 5. Updated Checkout Flow (src/lib/server-actions.ts)
**Modified:** `createOrderAndPayment()`

**New Steps:**
1. Insert order to database
2. Insert order items
3. **NEW: Reserve stock for 10 minutes** ← Prevents overbooking
4. If reservation fails: Cancel order & return error
5. Generate Midtrans QRIS payment token
6. If payment generation fails: Release reservation & return error

**Result:** Stock is held during checkout, preventing others from buying same items

### 6. Unified Dashboard Functions (src/lib/admin-actions.ts)
**New KPI Functions:**
- `getCombinedDailySalesSummary()` — Total revenue + transaction count (both channels)
- `getRevenueByChannel()` — Revenue breakdown (online vs offline)
- `getCombinedTopProducts()` — Best sellers across both channels
- `getPendingOrdersSummary()` — Active reservations + pending orders
- `getReservationStatus()` — How much stock is reserved by product

**Example:** Dashboard shows:
- Total Today: Rp 5,000,000 (Offline: Rp 3M + Online: Rp 2M)
- Transactions: 20 (Offline: 15 + Online: 5)
- Top Product: Varsity Jacket (25 sold: 15 offline + 10 online)

### 7. Error Logging & Monitoring (src/lib/admin-actions.ts)
**Functions:**
- `getSyncLogs()` — View recent sync operations (success/failed)
- `getSyncErrorSummary()` — Error count & breakdown by type
- `getStockDiscrepancies()` — Orders with payment but stock not reduced
- `getReservationStatus()` — Current reservation counts & products

**Usage:** Admin dashboard can show alerts for:
- ❌ Failed syncs (webhook issues)
- ⚠️ Orphaned orders (payment succeeded but stock not reduced)
- 📊 Stock reservation status (how much is held)

### 8. Test Suite (TEST_SUITE.md)
Comprehensive test documentation covering:
- Stock reservation tests
- Webhook integration tests
- Overbooking prevention tests
- Polling fallback tests
- Financial reporting tests
- Error handling tests
- SQL verification queries

---

## 🚀 How to Use

### For Online Checkout (Buyer Website)

**Flow:**
```
User adds to cart
        ↓
User clicks checkout
        ↓
createOrderAndPayment() called
        ↓
Stock reserved for 10 minutes
        ↓
Midtrans QRIS token generated
        ↓
User scans QR & pays
        ↓
Midtrans sends webhook to /api/webhook/midtrans
        ↓
Stock automatically reduced
        ↓
Order confirmed
```

**If payment fails:**
- Reservation automatically expires (10 min)
- Stock freed up for others
- User can retry or abandon

### For Offline Sales (POS/Kasir)

**Existing flow (unchanged):**
```
Cashier adds items
        ↓
Cashier processes payment
        ↓
createSale() reduces stock immediately
        ↓
Receipt printed
```

**No changes needed** - Stock reduction happens at payment time (same as before)

### Manual Monitoring & Triggers

**Admin Dashboard Access:**

```typescript
// Check if there are any failed syncs
const errors = await getSyncErrorSummary(24); // Last 24 hours
if (errors.summary.total_errors > 0) {
  // Show warning badge
}

// Check for orphaned orders
const discrepancies = await getStockDiscrepancies();
if (discrepancies.length > 0) {
  // Show "Sync Now" button for admin
  // When clicked: triggerStockSync()
}

// View revenue breakdown
const revenue = await getRevenueByChannel('2024-06-01', '2024-06-30');
console.log(`Online revenue: Rp ${revenue.channels.online.total_revenue}`);
console.log(`Offline revenue: Rp ${revenue.channels.offline.total_revenue}`);
```

**Manual Sync Triggers:**

```typescript
// Admin clicks "Sync Now" button
import { triggerStockSync, triggerExpireReservations } from '@/lib/admin-actions';

const syncResult = await triggerStockSync();
// Result: { success: true, synced: 5 }

const expireResult = await triggerExpireReservations();
// Result: { success: true, expiredCount: 2 }
```

---

## 🔄 Real-Time Sync Flow Diagram

```
ONLINE BUYER CHECKOUT          MIDTRANS PAYMENT          DATABASE
─────────────────────────────────────────────────────────────────────

User checkout starts
        │
        └──→ reserveStock()
             (10 min hold)
             
Payment generated
        │
        └──→ Midtrans QRIS
        
User pays
        │
        └──→ Midtrans processes
             (settlement status)
             
                                    Webhook received
                                          │
                                          └──→ POST /api/webhook/midtrans
                                               Verify signature
                                               
                                                    │
                                                    └──→ UPDATE inventory
                                                         INSERT stock_history
                                                         UPDATE orders.stock_reduced
                                                         UPDATE reservations.status
                                                         
OFFLINE POS SALE
─────────────────────────────────────────────────────────────────────

Cashier adds items
        │
        └──→ createSale()
             (checks inventory before adding)
             
Cashier processes payment
        │
        └──→ UPDATE inventory (reduce stock)
             INSERT stock_history
             Print receipt
             
POLLING FALLBACK (Every 5 min)
─────────────────────────────────────────────────────────────────────

syncStockFromPendingOrders()
        │
        └──→ Find orders where:
             - payment succeeded
             - stock_reduced = FALSE
             - created > 30 seconds ago
             
        │
        └──→ For each order:
             - UPDATE inventory
             - INSERT stock_history
             - Mark as stock_reduced
```

---

## 🛡️ Safety Features

### 1. First-Come-First-Served
Last item (stock=1) being checked out by 2 users:
- User A: `checkStockAvailability(productId, 1)` → TRUE (reserves 1)
- User B: `checkStockAvailability(productId, 1)` → FALSE (0 available after A's reservation)
- Result: B gets error "Insufficient stock"

### 2. Automatic Reservation Expiry
If user starts checkout but doesn't pay:
- Reservation created: expires_at = NOW() + 10 minutes
- At 11 minutes: `expireOldReservations()` changes status to 'expired'
- Stock becomes available again

### 3. Webhook Signature Verification
Prevents attackers from faking payment success:
```typescript
// Webhook signature verified using:
// HMAC_SHA512(order_id + status_code + gross_amount + server_key)
// Must match signature in request
```

### 4. Idempotency Check
Won't double-reduce stock:
- Webhook checks: `stock_reduced = FALSE` before reducing
- If TRUE (already reduced), skips
- Same order processed twice = only 1 inventory reduction

### 5. Polling Fallback
If webhook fails completely:
- Polling job finds pending payment confirmations
- Waits 30 seconds (give webhook time)
- Reduces stock if not already done

---

## 📊 Database Queries for Monitoring

### Current Stock Status
```sql
SELECT 
  p.id, p.name, i.stock,
  COALESCE(SUM(sr.quantity), 0) as reserved
FROM products p
JOIN inventory i ON p.id = i.product_id
LEFT JOIN stock_reservations sr ON p.id = sr.product_id 
  AND sr.status='active' AND sr.expires_at > NOW()
GROUP BY p.id
ORDER BY i.stock ASC;
```

### Recent Syncs (Last 20)
```sql
SELECT * FROM sync_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Failed Syncs
```sql
SELECT * FROM sync_logs 
WHERE status='failed' 
ORDER BY created_at DESC;
```

### Revenue by Channel (Today)
```sql
SELECT 
  'offline' as channel,
  COUNT(id) as transactions,
  SUM(total) as revenue
FROM sales
WHERE DATE(created_at) = CURDATE() AND status='completed'

UNION ALL

SELECT
  'online' as channel,
  COUNT(id) as transactions,
  SUM(gross_amount) as revenue
FROM orders
WHERE DATE(created_at) = CURDATE() 
  AND (transaction_status='settlement' OR transaction_status='success');
```

---

## 🔧 Configuration

### Webhook URL (Midtrans Dashboard)
1. Login to https://dashboard.sandbox.midtrans.com
2. Settings → Configuration → Webhooks
3. Set webhook URL: `https://yoursite.com/api/webhook/midtrans`
4. Enable notifications for: Settlement, Cancelled, Expired

### Polling Job Scheduling
Currently manual triggers via `triggerStockSync()`.

**To automate (future enhancement):**
- Add cron job to call every 5 minutes
- Or use external service (GitHub Actions, cron.is, etc.)

### Reservation Expiry Time
Default: 10 minutes. To change:
- Edit `reserveStock()` in admin-actions.ts
- Change: `expiresAt.setMinutes(expiresAt.getMinutes() + 10)`

---

## ⚠️ Important Notes

1. **Dummy Data:** Uses existing products from SETUP_DATABASE.sql
2. **Stock Reservation:** Only 10 minutes - balance between holding stock and availability
3. **Payment Status:** Only 'settlement' or 'success' triggers stock reduction
4. **First-Come-First-Served:** If 2 users buy same last item, first one gets it
5. **No Overbooking:** System won't allow overselling (checks available - reserved)
6. **Audit Trail:** All stock changes logged in stock_history + sync_logs

---

## 📝 Testing Checklist

- [ ] Stock reservation works (10 min hold)
- [ ] Overbooking prevented (1st user gets stock, 2nd rejected)
- [ ] Webhook reduces stock when payment succeeds
- [ ] Polling catches orphaned orders
- [ ] Dashboard shows combined revenue (online + offline)
- [ ] Error logging records sync failures
- [ ] POS sales still work (unchanged flow)
- [ ] Inventory never goes negative
- [ ] Reservation expires after 10 minutes

See [TEST_SUITE.md](TEST_SUITE.md) for detailed test cases.

---

## 🚨 Troubleshooting

**Stock shows "insufficient" but should be available?**
→ Check stock_reservations for active (not expired) reservations

**Webhook not being called?**
→ Verify URL in Midtrans settings, check sync_logs for errors

**Stock went negative?**
→ Check if reservations exist but weren't released properly

**Orders showing different stock than POS?**
→ Run `triggerStockSync()` to catch any missed syncs

---

## 📚 Files Modified/Created

**Modified:**
- `ADMIN_SETUP.sql` - Added schema
- `src/lib/admin-actions.ts` - Added reservation + reporting functions
- `src/lib/server-actions.ts` - Added stock reservation to checkout

**Created:**
- `src/routes/api/-webhook.ts` - Webhook endpoint
- `src/lib/stock-sync-job.ts` - Polling job
- `TEST_SUITE.md` - Test documentation
- `IMPLEMENTATION_GUIDE.md` - This file

---

## 📞 Support

For issues or questions:
1. Check TEST_SUITE.md for test cases
2. Review sync_logs table for error details
3. Check Midtrans dashboard webhook logs
4. Verify database schema with: `DESCRIBE stock_reservations;`

---

**Implementation Date:** June 22, 2024
**Status:** ✅ Complete & Ready for Testing
