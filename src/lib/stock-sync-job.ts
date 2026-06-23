// Poll for orders that should have stock reduced but haven't yet
export async function syncStockFromPendingOrders() {
  try {
    const { query, execute } = await import('./database');
    console.log('[Stock Sync] Running polling job...');

    // Find orders where:
    // 1. Payment is confirmed (settlement/success)
    // 2. Stock not yet reduced
    // 3. Created more than 30 seconds ago (give webhook time to process)

    const pendingOrders = await query<{
      id: number;
      order_id: string;
      transaction_status: string;
      created_at: string;
    }>(
      `SELECT id, order_id, transaction_status, created_at 
       FROM orders 
       WHERE stock_reduced = FALSE 
       AND (transaction_status = 'settlement' OR transaction_status = 'success')
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)
       LIMIT 100`
    );

    if (pendingOrders.length === 0) {
      console.log('[Stock Sync] No pending orders to sync');
      return { success: true, synced: 0 };
    }

    console.log(`[Stock Sync] Found ${pendingOrders.length} pending orders to sync`);

    let syncedCount = 0;

    for (const order of pendingOrders) {
      try {
        // Get order items
        const orderItems = await query<{ product_id: number; quantity: number }>(
          `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
          [order.order_id]
        );

        // Reduce stock for each item
        for (const item of orderItems) {
          if (item.product_id) {
            await execute('UPDATE inventory SET stock = stock - ? WHERE product_id = ?', [
              item.quantity,
              item.product_id,
            ]);

            await execute(
              `INSERT INTO stock_history (product_id, type, quantity, reference_id, reference_type)
               VALUES (?, ?, ?, ?, ?)`,
              [item.product_id, 'out', item.quantity, order.order_id, 'online']
            );

            // Log the sync
            await execute(
              `INSERT INTO sync_logs (sync_type, order_id, product_id, quantity, status)
               VALUES (?, ?, ?, ?, ?)`,
              ['polling', order.order_id, item.product_id, item.quantity, 'success']
            );
          }
        }

        // Mark order as stock_reduced
        await execute(`UPDATE orders SET stock_reduced = TRUE WHERE order_id = ?`, [order.order_id]);

        // Complete reservations for this order
        await execute(
          `UPDATE stock_reservations SET status = 'completed' WHERE order_id = ?`,
          [order.order_id]
        );

        syncedCount++;
        console.log(`[Stock Sync] Synced order ${order.order_id}`);
      } catch (error) {
        console.error(`[Stock Sync] Error syncing order ${order.order_id}:`, error);

        // Log error
        await execute(
          `INSERT INTO sync_logs (sync_type, order_id, status, error_message)
           VALUES (?, ?, ?, ?)`,
          [
            'polling',
            order.order_id,
            'failed',
            error instanceof Error ? error.message : 'Unknown error',
          ]
        );
      }
    }

    console.log(`[Stock Sync] Completed polling job - synced ${syncedCount} orders`);
    return { success: true, synced: syncedCount };
  } catch (error) {
    console.error('[Stock Sync] Polling job error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      synced: 0,
    };
  }
}

// Expire old reservations (run periodically)
export async function expireOldStockReservations() {
  try {
    const { execute } = await import('./database');
    console.log('[Stock Sync] Checking for expired reservations...');

    const result = await execute(
      `UPDATE stock_reservations 
       SET status = 'expired' 
       WHERE status = 'active' AND expires_at < NOW()`,
      []
    );

    console.log(`[Stock Sync] Expired ${result.affectedRows} old reservations`);
    return { success: true, expiredCount: result.affectedRows };
  } catch (error) {
    console.error('[Stock Sync] Error expiring reservations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Check and log any stock discrepancies (for monitoring)
export async function checkStockDiscrepancies() {
  try {
    const { query } = await import('./database');
    console.log('[Stock Sync] Checking for stock discrepancies...');

    // Get products with reserved stock but no corresponding reservations
    const discrepancies = await query<{
      product_id: number;
      reserved_amount: number;
    }>(
      `SELECT sr.product_id, SUM(sr.quantity) as reserved_amount
       FROM stock_reservations sr
       WHERE sr.status = 'active'
       GROUP BY sr.product_id`
    );

    if (discrepancies.length > 0) {
      console.log(`[Stock Sync] Found ${discrepancies.length} products with reservations`);
    }

    return { success: true, discrepancies };
  } catch (error) {
    console.error('[Stock Sync] Error checking discrepancies:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
