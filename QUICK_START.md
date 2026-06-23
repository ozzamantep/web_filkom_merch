/**
 * QUICK START GUIDE - Real-Time Stock Sync
 * 
 * This file shows the key functions and how to use them
 * Copy-paste examples for your dashboard components
 */

// ============================================================
// 1. CHECK STOCK AVAILABILITY BEFORE ADDING TO CART
// ============================================================

import { checkStockAvailability } from '@/lib/admin-actions';

// Example: Product detail page
async function checkAvailability(productId: number, quantity: number) {
  const result = await checkStockAvailability(productId, quantity);
  
  if (!result.available) {
    return {
      canBuy: false,
      message: `Only ${result.availableStock} available. You tried to buy ${result.requestedQuantity}.`
    };
  }
  
  return {
    canBuy: true,
    message: `${result.availableStock} available`,
    availableStock: result.availableStock
  };
}

// ============================================================
// 2. RESERVE STOCK DURING CHECKOUT
// ============================================================

import { reserveStock } from '@/lib/admin-actions';
import { createOrderAndPayment } from '@/lib/server-actions';

// Example: Checkout page (Step 1: Validate & Reserve)
async function startCheckout(cartItems: CartItem[], orderInfo: OrderInfo) {
  const orderId = `ORD-${Date.now()}`;
  
  try {
    // Step 1: Check availability
    for (const item of cartItems) {
      const check = await checkStockAvailability(item.product_id, item.quantity);
      if (!check.available) {
        throw new Error(`${item.name}: Only ${check.availableStock} available`);
      }
    }
    
    // Step 2: Reserve stock for 10 minutes
    const reservation = await reserveStock(orderId, cartItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size || 'One Size'
    })));
    
    if (!reservation.success) {
      throw new Error(reservation.error);
    }
    
    console.log(`✅ Stock reserved: ${reservation.reservationCount} items for 10 minutes`);
    
    // Step 3: Create order and generate payment
    const payment = await createOrderAndPayment({
      orderId,
      grossAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      customerName: orderInfo.name,
      customerEmail: orderInfo.email,
      customerPhone: orderInfo.phone,
      items: cartItems.map(item => ({
        id: item.product_id.toString(),
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    });
    
    if (!payment.success) {
      // If payment generation fails, reservation will auto-expire in 10 min
      throw new Error(payment.error);
    }
    
    return {
      success: true,
      orderId,
      qrUrl: payment.qrUrl,
      token: payment.token
    };
    
  } catch (error) {
    // Cleanup: Release reservation if something failed
    await releaseReservation(orderId);
    throw error;
  }
}

// ============================================================
// 3. COMPLETE RESERVATION WHEN PAYMENT SUCCEEDS
// ============================================================

// Note: This is automatically called by webhook when Midtrans sends payment confirmation
// But you can also call it manually if needed:

import { completeReservation } from '@/lib/admin-actions';

// Example: Manual sync button in admin dashboard
async function manualSyncOrder(orderId: string) {
  const result = await completeReservation(orderId);
  
  if (result.success) {
    console.log(`✅ Stock reduced for ${result.itemsProcessed} items`);
    return { success: true };
  } else {
    console.error(`❌ Sync failed: ${result.error}`);
    return { success: false, error: result.error };
  }
}

// ============================================================
// 4. DISPLAY UNIFIED KPIs ON DASHBOARD
// ============================================================

import { 
  getCombinedDailySalesSummary,
  getRevenueByChannel,
  getCombinedTopProducts 
} from '@/lib/admin-actions';

// Example: Dashboard KPI Cards
async function fetchDashboardKPIs(date: string) {
  // Unified daily summary
  const dailyData = await getCombinedDailySalesSummary(date);
  
  const kpiCards = [
    {
      label: 'Total Revenue',
      value: `Rp ${(dailyData.summary.total_revenue).toLocaleString()}`,
      detail: `${dailyData.summary.total_transactions} transactions`,
      offline: `Rp ${(dailyData.summary.offline_revenue).toLocaleString()} (${dailyData.summary.offline_transactions})`,
      online: `Rp ${(dailyData.summary.online_revenue).toLocaleString()} (${dailyData.summary.online_transactions})`
    },
    {
      label: 'Avg Transaction',
      value: `Rp ${(dailyData.summary.avg_transaction).toLocaleString()}`,
      detail: 'Per transaction'
    },
    {
      label: 'Discount Given',
      value: `Rp ${(dailyData.summary.total_discount).toLocaleString()}`,
      detail: 'Offline only'
    }
  ];
  
  return kpiCards;
}

// Example: Revenue by Channel Breakdown
async function fetchChannelBreakdown(startDate: string, endDate: string) {
  const data = await getRevenueByChannel(startDate, endDate);
  
  const chartData = [
    {
      name: 'Offline',
      value: data.channels.offline.total_revenue,
      transactions: data.channels.offline.transaction_count,
      avgTransaction: data.channels.offline.avg_transaction
    },
    {
      name: 'Online',
      value: data.channels.online.total_revenue,
      transactions: data.channels.online.transaction_count,
      avgTransaction: data.channels.online.avg_transaction
    }
  ];
  
  return chartData;
}

// Example: Top Products across both channels
async function fetchTopProducts() {
  const products = await getCombinedTopProducts(10, 30); // Top 10, last 30 days
  
  return products.map(p => ({
    name: p.name,
    totalSold: p.total_quantity_sold,
    offlineSold: p.offline_quantity,
    onlineSold: p.online_quantity,
    totalRevenue: p.total_revenue
  }));
}

// ============================================================
// 5. MONITOR PENDING ORDERS & RESERVATIONS
// ============================================================

import { getPendingOrdersSummary } from '@/lib/admin-actions';

// Example: Dashboard Status Panel
async function fetchPendingStatus() {
  const data = await getPendingOrdersSummary();
  
  const statusPanel = {
    activeReservations: {
      count: data.activeReservations.reservation_count,
      stock: data.activeReservations.total_reserved,
      message: `${data.activeReservations.reservation_count} users checking out (holding ${data.activeReservations.total_reserved} items)`
    },
    pendingOrders: data.pendingOrders.map(order => ({
      id: order.order_id,
      customer: order.customer_name,
      amount: order.gross_amount,
      createdAt: order.created_at,
      status: 'Awaiting Payment'
    }))
  };
  
  return statusPanel;
}

// ============================================================
// 6. MONITOR SYNC ERRORS & DISCREPANCIES
// ============================================================

import { 
  getSyncErrorSummary,
  getStockDiscrepancies,
  getReservationStatus 
} from '@/lib/admin-actions';

// Example: Error Alert Banner
async function checkSyncHealth() {
  const errors = await getSyncErrorSummary(24); // Last 24 hours
  
  if (errors.summary.total_errors > 0) {
    return {
      hasErrors: true,
      severity: errors.summary.total_errors > 5 ? 'high' : 'medium',
      message: `⚠️ ${errors.summary.total_errors} sync errors in last 24h (${errors.summary.webhook_errors} webhook, ${errors.summary.polling_errors} polling)`,
      action: 'Review sync logs'
    };
  }
  
  return { hasErrors: false };
}

// Example: Discrepancy Alert
async function checkStockMismatches() {
  const discrepancies = await getStockDiscrepancies();
  
  if (discrepancies.length > 0) {
    return {
      hasIssues: true,
      message: `⚠️ ${discrepancies.length} orders with payment but stock not reduced`,
      orders: discrepancies.map(d => ({
        orderId: d.order_id,
        customer: d.customer_name,
        minutesPending: d.minutes_since_created,
        action: 'Sync Now'
      }))
    };
  }
  
  return { hasIssues: false };
}

// Example: Reservation Status Monitor
async function monitorReservations() {
  const status = await getReservationStatus();
  
  return {
    byStatus: status.byStatus,
    activeProducts: status.activeByProduct.map(p => ({
      productName: p.product_name,
      reserved: p.reserved_quantity,
      currentStock: p.current_stock,
      warning: p.reserved_quantity > p.current_stock ? '⚠️ Over-reserved!' : ''
    }))
  };
}

// ============================================================
// 7. TRIGGER MANUAL SYNC
// ============================================================

import { triggerStockSync, triggerExpireReservations } from '@/lib/admin-actions';

// Example: Admin actions (dropdown menu on dashboard)
async function adminSyncActions(action: 'sync' | 'expire') {
  if (action === 'sync') {
    const result = await triggerStockSync();
    return {
      success: result.success,
      message: result.success 
        ? `✅ Synced ${result.synced} orders`
        : `❌ Sync failed: ${result.error}`
    };
  }
  
  if (action === 'expire') {
    const result = await triggerExpireReservations();
    return {
      success: result.success,
      message: result.success
        ? `✅ Expired ${result.expiredCount} old reservations`
        : `❌ Expiration failed: ${result.error}`
    };
  }
}

// ============================================================
// 8. VIEW SYNC LOGS
// ============================================================

import { getSyncLogs } from '@/lib/admin-actions';

// Example: Sync Logs Table
async function fetchSyncLogs(limit: number = 50, statusFilter?: string) {
  const logs = await getSyncLogs(limit, statusFilter as any);
  
  return logs.map(log => ({
    type: log.sync_type,
    orderId: log.order_id,
    product: log.product_id,
    quantity: log.quantity,
    status: log.status,
    error: log.error_message,
    timestamp: new Date(log.created_at).toLocaleString()
  }));
}

// ============================================================
// 9. INTEGRATION EXAMPLE - COMPLETE DASHBOARD
// ============================================================

async function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const last30days = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
  
  // Fetch all data in parallel
  const [
    kpis,
    channelBreakdown,
    topProducts,
    pendingStatus,
    syncHealth,
    mismatches,
    reservations,
    syncLogs
  ] = await Promise.all([
    fetchDashboardKPIs(today),
    fetchChannelBreakdown(last30days, today),
    fetchTopProducts(),
    fetchPendingStatus(),
    checkSyncHealth(),
    checkStockMismatches(),
    monitorReservations(),
    fetchSyncLogs(20)
  ]);
  
  return {
    // Top section
    alerts: [
      syncHealth.hasErrors && { type: 'error', message: syncHealth.message },
      mismatches.hasIssues && { type: 'warning', message: mismatches.message }
    ].filter(Boolean),
    
    // KPI Cards
    kpis,
    
    // Charts
    channelChart: channelBreakdown,
    topProductsChart: topProducts,
    
    // Status panels
    pendingOrders: pendingStatus.pendingOrders,
    activeReservations: pendingStatus.activeReservations,
    reservationStatus: reservations,
    
    // Admin actions
    adminActions: [
      { label: 'Sync Now', action: 'sync' },
      { label: 'Expire Reservations', action: 'expire' }
    ],
    
    // Recent activity
    syncLogs
  };
}

// ============================================================
// 10. ERROR HANDLING BEST PRACTICES
// ============================================================

async function checkoutWithErrorHandling(cartItems: CartItem[], orderInfo: OrderInfo) {
  try {
    // Step 1: Check if still available
    for (const item of cartItems) {
      const check = await checkStockAvailability(item.product_id, item.quantity);
      if (!check.available) {
        // User-friendly error
        throw new Error(`Sorry, only ${check.availableStock} of "${item.name}" available`);
      }
    }
    
    // Step 2: Start checkout
    const checkout = await startCheckout(cartItems, orderInfo);
    
    if (!checkout.success) {
      throw new Error('Failed to start checkout. Please try again.');
    }
    
    return checkout;
    
  } catch (error) {
    // Log for debugging
    console.error('Checkout error:', error);
    
    // Return user-friendly message
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Checkout failed'
    };
  }
}

// ============================================================
// SUMMARY OF KEY FUNCTIONS
// ============================================================

/*
CUSTOMER FACING:
- checkStockAvailability(productId, quantity) → {available, availableStock}
- startCheckout(...) → {orderId, qrUrl}

ADMIN DASHBOARD:
- getCombinedDailySalesSummary(date) → {total_revenue, transactions, breakdown}
- getRevenueByChannel(startDate, endDate) → {offline, online, combined}
- getCombinedTopProducts(limit, days) → [{name, totalSold, offlineSold, onlineSold}]
- getPendingOrdersSummary() → {activeReservations, pendingOrders}
- checkSyncHealth() → {hasErrors, severity, message}
- getStockDiscrepancies() → [{orderId, minutesPending}]

MONITORING:
- getSyncLogs(limit, status) → [{type, orderId, status, timestamp}]
- getReservationStatus() → {byStatus, activeByProduct}

ADMIN ACTIONS:
- triggerStockSync() → {success, synced}
- triggerExpireReservations() → {success, expiredCount}
- manualSyncOrder(orderId) → {success}

INTERNAL:
- reserveStock(orderId, items) → {success, reservationCount}
- completeReservation(orderId) → {success, itemsProcessed}
- releaseReservation(orderId) → {success}
*/

export { };
