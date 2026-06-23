import { createServerFn } from '@tanstack/react-start';

// ============ SALES/KASIR ACTIONS ============

export interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface CreateSaleInput {
  admin_id: number;
  payment_method_id: number;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
}

export interface Sale {
  id: number;
  sale_id: string;
  admin_id: number;
  payment_method_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Create new sale (kasir transaction)
export const createSale = createServerFn({ method: 'POST' })(
  async (input: CreateSaleInput) => {
    try {
      const { execute } = await import('./database');
      const saleId = `SALE-${Date.now()}`;

      // 1. Insert sale
      const result = await execute(
        `INSERT INTO sales (
          sale_id, admin_id, payment_method_id, subtotal, discount, tax, total, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          input.admin_id,
          input.payment_method_id,
          input.subtotal,
          input.discount,
          input.tax,
          input.total,
          'completed',
        ]
      );

      const saleDbId = result.insertId;

      // 2. Insert sale items
      for (const item of input.items) {
        await execute(
          `INSERT INTO sale_items (
            sale_id, product_id, product_name, quantity, unit_price, discount, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            saleDbId,
            item.product_id || null,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.discount,
            item.quantity * item.unit_price - item.discount,
          ]
        );

        // 3. Update inventory (decrease stock)
        if (item.product_id) {
          await execute(
            'UPDATE inventory SET stock = stock - ? WHERE product_id = ?',
            [item.quantity, item.product_id]
          );

          // 4. Log to stock history
          await execute(
            `INSERT INTO stock_history (product_id, type, quantity, reference_id, reference_type, admin_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [item.product_id, 'out', item.quantity, saleId, 'sale', input.admin_id]
          );
        }
      }

      return {
        success: true,
        sale_id: saleId,
        db_id: saleDbId,
        message: 'Sale created successfully',
      };
    } catch (error) {
      console.error('Error creating sale:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sale',
      };
    }
  }
);

// Get sales by date range
export const getSalesByDateRange = createServerFn(
  { method: 'GET' },
  async (startDate: string, endDate: string, adminId?: number) => {
    try {
      const { query } = await import('./database');
      const whereClause = adminId
        ? 'WHERE DATE(s.created_at) BETWEEN ? AND ? AND s.admin_id = ?'
        : 'WHERE DATE(s.created_at) BETWEEN ? AND ?';

      const params = adminId ? [startDate, endDate, adminId] : [startDate, endDate];

      const sales = await query<Sale & { payment_method: string }>(
        `SELECT s.*, pm.name as payment_method
         FROM sales s
         LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
         ${whereClause}
         ORDER BY s.created_at DESC`,
        params
      );

      return { success: true, sales };
    } catch (error) {
      console.error('Error fetching sales:', error);
      return { success: false, sales: [], error: 'Failed to fetch sales' };
    }
  }
);

// Get daily sales summary
export const getDailySalesSummary = createServerFn(
  { method: 'GET' },
  async (date: string) => {
    try {
      const { queryOne } = await import('./database');
      const result = await queryOne<{
        total_transactions: number;
        total_revenue: number;
        total_discount: number;
        avg_transaction: number;
      }>(
        `SELECT
          COUNT(id) as total_transactions,
          SUM(total) as total_revenue,
          SUM(discount) as total_discount,
          AVG(total) as avg_transaction
         FROM sales
         WHERE DATE(created_at) = ? AND status = 'completed'`,
        [date]
      );

      return {
        success: true,
        summary: result || {
          total_transactions: 0,
          total_revenue: 0,
          total_discount: 0,
          avg_transaction: 0,
        },
      };
    } catch (error) {
      console.error('Error fetching daily summary:', error);
      return { success: false, summary: null, error: 'Failed to fetch summary' };
    }
  }
);

// Get top selling products
export const getTopProducts = createServerFn(
  { method: 'GET' },
  async (limit: number = 10, days: number = 30) => {
    try {
      const { query } = await import('./database');
      const products = await query<{
        id: number;
        name: string;
        total_quantity_sold: number;
        total_revenue: number;
      }>(
        `SELECT
          p.id,
          p.name,
          SUM(si.quantity) as total_quantity_sold,
          SUM(si.subtotal) as total_revenue
         FROM products p
         JOIN sale_items si ON p.id = si.product_id
         JOIN sales s ON si.sale_id = s.id
         WHERE s.status = 'completed' AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY p.id
         ORDER BY total_quantity_sold DESC
         LIMIT ?`,
        [days, limit]
      );

      return { success: true, products };
    } catch (error) {
      console.error('Error fetching top products:', error);
      return { success: false, products: [], error: 'Failed to fetch products' };
    }
  }
);

// ============ INVENTORY ACTIONS ============

export interface InventoryItem {
  id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  stock: number;
  min_stock: number;
  status: 'ok' | 'low' | 'out';
}

export const getInventory = createServerFn(
  { method: 'GET' },
  async () => {
    try {
      const { query } = await import('./database');
      const inventory = await query<InventoryItem>(
        `SELECT
          i.id,
          i.product_id,
          p.name as product_name,
          p.price as product_price,
          i.stock,
          i.min_stock,
          CASE 
            WHEN i.stock = 0 THEN 'out'
            WHEN i.stock <= i.min_stock THEN 'low'
            ELSE 'ok'
          END as status
         FROM inventory i
         JOIN products p ON i.product_id = p.id
         ORDER BY i.stock ASC`
      );

      return { success: true, inventory };
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return { success: false, inventory: [], error: 'Failed to fetch inventory' };
    }
  }
);

// Update stock manually
export const updateStock = createServerFn(
  { method: 'POST' },
  async (productId: number, quantity: number, type: 'in' | 'adjustment', adminId: number, notes?: string) => {
    try {
      const { execute } = await import('./database');
      const operator = type === 'in' ? '+' : '-';

      await execute(
        `UPDATE inventory SET stock = stock ${operator === '+' ? '+' : '-'} ? WHERE product_id = ?`,
        [Math.abs(quantity), productId]
      );

      // Log to history
      await execute(
        `INSERT INTO stock_history (product_id, type, quantity, reference_type, notes, admin_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, type === 'in' ? 'in' : 'adjustment', Math.abs(quantity), type, notes || null, adminId]
      );

      return { success: true, message: 'Stock updated successfully' };
    } catch (error) {
      console.error('Error updating stock:', error);
      return { success: false, error: 'Failed to update stock' };
    }
  }
);

// ============ PRINTER CONFIGURATION ============

export interface PrinterConfig {
  id: number;
  printer_name: string;
  printer_mac_address: string;
  printer_type: string;
  printer_brand: string;
  paper_width: number;
  is_active: boolean;
}

export const savePrinterConfig = createServerFn(
  { method: 'POST' },
  async (adminId: number, config: Omit<PrinterConfig, 'id'>) => {
    try {
      const { execute } = await import('./database');
      await execute(
        `INSERT INTO printer_config (
          admin_id, printer_name, printer_mac_address, printer_type, printer_brand, paper_width, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          printer_name = VALUES(printer_name),
          printer_mac_address = VALUES(printer_mac_address),
          printer_type = VALUES(printer_type),
          printer_brand = VALUES(printer_brand),
          paper_width = VALUES(paper_width),
          is_active = VALUES(is_active)`,
        [
          adminId,
          config.printer_name,
          config.printer_mac_address,
          config.printer_type,
          config.printer_brand,
          config.paper_width,
          config.is_active ? 1 : 0,
        ]
      );

      return { success: true, message: 'Printer configured successfully' };
    } catch (error) {
      console.error('Error saving printer config:', error);
      return { success: false, error: 'Failed to save printer config' };
    }
  }
);

export const getPrinterConfig = createServerFn(
  { method: 'GET' },
  async (adminId: number) => {
    try {
      const { queryOne } = await import('./database');
      const config = await queryOne<PrinterConfig>(
        'SELECT * FROM printer_config WHERE admin_id = ?',
        [adminId]
      );

      return { success: true, config };
    } catch (error) {
      console.error('Error fetching printer config:', error);
      return { success: false, config: null, error: 'Failed to fetch printer config' };
    }
  }
);

// ============ PAYMENT METHODS ============

export const getPaymentMethods = createServerFn(
  { method: 'GET' },
  async () => {
    try {
      const { query } = await import('./database');
      const methods = await query(
        'SELECT id, code, name, description FROM payment_methods WHERE is_active = TRUE ORDER BY name'
      );

      return { success: true, methods };
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return { success: false, methods: [], error: 'Failed to fetch payment methods' };
    }
  }
);

// ============ STOCK RESERVATION (Real-time Sync) ============

export interface StockReservation {
  id: number;
  order_id: string;
  product_id: number;
  size?: string;
  quantity: number;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  created_at: string;
}

// Check stock availability (considering active reservations)
export const checkStockAvailability = createServerFn(
  { method: 'POST' },
  async (productId: number, requestedQuantity: number, size?: string) => {
    try {
      const { queryOne } = await import('./database');
      // Get current stock
      const stockResult = await queryOne<{ stock: number }>(
        'SELECT stock FROM inventory WHERE product_id = ?',
        [productId]
      );

      const currentStock = stockResult?.stock || 0;

      // Get reserved stock from active reservations
      const reservedResult = await queryOne<{ reserved: number }>(
        `SELECT COALESCE(SUM(quantity), 0) as reserved 
         FROM stock_reservations 
         WHERE product_id = ? AND status = 'active' AND expires_at > NOW()`,
        [productId]
      );

      const reservedStock = reservedResult?.reserved || 0;
      const availableStock = currentStock - reservedStock;

      return {
        success: true,
        available: availableStock >= requestedQuantity,
        availableStock,
        currentStock,
        reservedStock,
        requestedQuantity,
      };
    } catch (error) {
      console.error('Error checking stock availability:', error);
      return {
        success: false,
        available: false,
        availableStock: 0,
        currentStock: 0,
        reservedStock: 0,
        requestedQuantity: 0,
        error: 'Failed to check stock availability',
      };
    }
  }
);

// Reserve stock for an order (prevents overbooking)
export const reserveStock = createServerFn(
  { method: 'POST' },
  async (orderId: string, items: Array<{ product_id: number; quantity: number; size?: string }>) => {
    try {
      const { execute } = await import('./database');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

      const reservationIds: number[] = [];

      for (const item of items) {
        // Check availability first
        const availabilityCheck = await checkStockAvailability(
          item.product_id,
          item.quantity,
          item.size
        );

        if (!availabilityCheck.available) {
          // Rollback: delete any reservations already created
          if (reservationIds.length > 0) {
            await execute(
              `DELETE FROM stock_reservations WHERE id IN (${reservationIds.join(',')})`,
              []
            );
          }
          return {
            success: false,
            error: `Insufficient stock for product ${item.product_id}. Available: ${availabilityCheck.availableStock}, Requested: ${item.quantity}`,
          };
        }

        // Create reservation
        const result = await execute(
          `INSERT INTO stock_reservations (order_id, product_id, size, quantity, expires_at, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [orderId, item.product_id, item.size || null, item.quantity, expiresAt]
        );

        reservationIds.push(result.insertId);
      }

      return {
        success: true,
        message: `${reservationIds.length} items reserved for 10 minutes`,
        reservationCount: reservationIds.length,
      };
    } catch (error) {
      console.error('Error reserving stock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reserve stock',
      };
    }
  }
);

// Release reservation (cancels it)
export const releaseReservation = createServerFn(
  { method: 'POST' },
  async (orderId: string) => {
    try {
      const { execute } = await import('./database');
      const result = await execute(
        `UPDATE stock_reservations SET status = 'cancelled' WHERE order_id = ? AND status = 'active'`,
        [orderId]
      );

      return {
        success: true,
        message: `Released ${result.affectedRows} reservations for order ${orderId}`,
      };
    } catch (error) {
      console.error('Error releasing reservation:', error);
      return {
        success: false,
        error: 'Failed to release reservation',
      };
    }
  }
);

// Complete reservation (when payment succeeds, reduce actual stock)
export const completeReservation = createServerFn(
  { method: 'POST' },
  async (orderId: string, adminIdOrChannel?: number | string) => {
    try {
      const { query, execute } = await import('./database');
      // Get all active reservations for this order
      const reservations = await query<StockReservation>(
        `SELECT * FROM stock_reservations WHERE order_id = ? AND status = 'active'`,
        [orderId]
      );

      if (reservations.length === 0) {
        return {
          success: false,
          error: 'No active reservations found for this order',
        };
      }

      // Reduce inventory for each reserved item
      for (const reservation of reservations) {
        // Update inventory
        await execute(
          'UPDATE inventory SET stock = stock - ? WHERE product_id = ?',
          [reservation.quantity, reservation.product_id]
        );

        // Log to stock history
        await execute(
          `INSERT INTO stock_history (product_id, type, quantity, reference_id, reference_type, admin_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [reservation.product_id, 'out', reservation.quantity, orderId, 'online', adminIdOrChannel || null]
        );

        // Mark reservation as completed
        await execute(
          `UPDATE stock_reservations SET status = 'completed' WHERE id = ?`,
          [reservation.id]
        );
      }

      // Mark order as stock_reduced
      await execute(
        `UPDATE orders SET stock_reduced = TRUE WHERE order_id = ?`,
        [orderId]
      );

      return {
        success: true,
        message: `Stock reduced for ${reservations.length} items from order ${orderId}`,
        itemsProcessed: reservations.length,
      };
    } catch (error) {
      console.error('Error completing reservation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete reservation',
      };
    }
  }
);

// Expire old reservations (scheduled job, run periodically)
export const expireOldReservations = createServerFn(
  { method: 'POST' },
  async () => {
    try {
      const { execute } = await import('./database');
      const result = await execute(
        `UPDATE stock_reservations 
         SET status = 'expired' 
         WHERE status = 'active' AND expires_at < NOW()`,
        []
      );

      return {
        success: true,
        message: `Expired ${result.affectedRows} old reservations`,
        expiredCount: result.affectedRows,
      };
    } catch (error) {
      console.error('Error expiring reservations:', error);
      return {
        success: false,
        error: 'Failed to expire reservations',
      };
    }
  }
);

// Get reservations for an order
export const getOrderReservations = createServerFn(
  { method: 'GET' },
  async (orderId: string) => {
    try {
      const reservations = await query<StockReservation>(
        `SELECT * FROM stock_reservations WHERE order_id = ? ORDER BY created_at DESC`,
        [orderId]
      );

      return { success: true, reservations };
    } catch (error) {
      console.error('Error fetching reservations:', error);
      return { success: false, reservations: [], error: 'Failed to fetch reservations' };
    }
  }
);

// ============ MANUAL SYNC TRIGGERS ============

// Manually trigger stock sync from pending orders (polling)
export const triggerStockSync = createServerFn(
  { method: 'POST' },
  async () => {
    try {
      const result = await syncStockFromPendingOrders();
      return result;
    } catch (error) {
      console.error('Error triggering stock sync:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger sync',
      };
    }
  }
);

// Manually expire old reservations
export const triggerExpireReservations = createServerFn(
  { method: 'POST' },
  async () => {
    try {
      const result = await expireOldStockReservations();
      return result;
    } catch (error) {
      console.error('Error triggering expiration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to expire reservations',
      };
    }
  }
);

// ============ UNIFIED SALES REPORTING (Online + Offline) ============

// Get combined daily sales summary (online + offline)
export const getCombinedDailySalesSummary = createServerFn(
  { method: 'GET' },
  async (date: string) => {
    try {
      // Offline sales
      const offlineSummary = await queryOne<{
        offline_transactions: number;
        offline_revenue: number;
        offline_discount: number;
      }>(
        `SELECT
          COUNT(id) as offline_transactions,
          SUM(total) as offline_revenue,
          SUM(discount) as offline_discount
         FROM sales
         WHERE DATE(created_at) = ? AND status = 'completed'`,
        [date]
      );

      // Online sales
      const onlineSummary = await queryOne<{
        online_transactions: number;
        online_revenue: number;
      }>(
        `SELECT
          COUNT(id) as online_transactions,
          SUM(gross_amount) as online_revenue
         FROM orders
         WHERE DATE(created_at) = ? AND (transaction_status = 'settlement' OR transaction_status = 'success')`,
        [date]
      );

      // Combined summary
      const totalTransactions = (offlineSummary?.offline_transactions || 0) + (onlineSummary?.online_transactions || 0);
      const totalRevenue = (offlineSummary?.offline_revenue || 0) + (onlineSummary?.online_revenue || 0);
      const totalDiscount = offlineSummary?.offline_discount || 0;

      return {
        success: true,
        summary: {
          total_transactions: totalTransactions,
          total_revenue: totalRevenue,
          total_discount: totalDiscount,
          avg_transaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          offline_transactions: offlineSummary?.offline_transactions || 0,
          offline_revenue: offlineSummary?.offline_revenue || 0,
          online_transactions: onlineSummary?.online_transactions || 0,
          online_revenue: onlineSummary?.online_revenue || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching combined daily summary:', error);
      return {
        success: false,
        summary: null,
        error: 'Failed to fetch combined summary',
      };
    }
  }
);

// Get revenue by channel (online vs offline)
export const getRevenueByChannel = createServerFn(
  { method: 'GET' },
  async (startDate: string, endDate: string) => {
    try {
      // Offline revenue
      const offlineRevenue = await queryOne<{
        total_revenue: number;
        transaction_count: number;
        avg_transaction: number;
      }>(
        `SELECT
          SUM(total) as total_revenue,
          COUNT(id) as transaction_count,
          AVG(total) as avg_transaction
         FROM sales
         WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'`,
        [startDate, endDate]
      );

      // Online revenue
      const onlineRevenue = await queryOne<{
        total_revenue: number;
        transaction_count: number;
        avg_transaction: number;
      }>(
        `SELECT
          SUM(gross_amount) as total_revenue,
          COUNT(id) as transaction_count,
          AVG(gross_amount) as avg_transaction
         FROM orders
         WHERE DATE(created_at) BETWEEN ? AND ? AND (transaction_status = 'settlement' OR transaction_status = 'success')`,
        [startDate, endDate]
      );

      return {
        success: true,
        channels: {
          offline: {
            total_revenue: offlineRevenue?.total_revenue || 0,
            transaction_count: offlineRevenue?.transaction_count || 0,
            avg_transaction: offlineRevenue?.avg_transaction || 0,
          },
          online: {
            total_revenue: onlineRevenue?.total_revenue || 0,
            transaction_count: onlineRevenue?.transaction_count || 0,
            avg_transaction: onlineRevenue?.avg_transaction || 0,
          },
          combined: {
            total_revenue: (offlineRevenue?.total_revenue || 0) + (onlineRevenue?.total_revenue || 0),
            transaction_count: (offlineRevenue?.transaction_count || 0) + (onlineRevenue?.transaction_count || 0),
          },
        },
      };
    } catch (error) {
      console.error('Error fetching revenue by channel:', error);
      return { success: false, channels: null, error: 'Failed to fetch revenue breakdown' };
    }
  }
);

// Get combined top products (from both online and offline sales)
export const getCombinedTopProducts = createServerFn(
  { method: 'GET' },
  async (limit: number = 10, days: number = 30) => {
    try {
      const products = await query<{
        id: number;
        name: string;
        total_quantity_sold: number;
        total_revenue: number;
        offline_quantity: number;
        online_quantity: number;
      }>(
        `SELECT
          p.id,
          p.name,
          COALESCE(offline.total_qty, 0) + COALESCE(online.total_qty, 0) as total_quantity_sold,
          COALESCE(offline.total_revenue, 0) + COALESCE(online.total_revenue, 0) as total_revenue,
          COALESCE(offline.total_qty, 0) as offline_quantity,
          COALESCE(online.total_qty, 0) as online_quantity
         FROM products p
         LEFT JOIN (
           SELECT p.id, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
           FROM products p
           JOIN sale_items si ON p.id = si.product_id
           JOIN sales s ON si.sale_id = s.id
           WHERE s.status = 'completed' AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           GROUP BY p.id
         ) offline ON p.id = offline.id
         LEFT JOIN (
           SELECT p.id, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
           FROM products p
           JOIN order_items oi ON p.id = oi.product_id
           JOIN orders o ON oi.order_id = o.order_id
           WHERE (o.transaction_status = 'settlement' OR o.transaction_status = 'success') AND DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           GROUP BY p.id
         ) online ON p.id = online.id
         WHERE COALESCE(offline.total_qty, 0) + COALESCE(online.total_qty, 0) > 0
         ORDER BY total_quantity_sold DESC
         LIMIT ?`,
        [days, days, limit]
      );

      return { success: true, products };
    } catch (error) {
      console.error('Error fetching combined top products:', error);
      return { success: false, products: [], error: 'Failed to fetch products' };
    }
  }
);

// Get active reservations and pending orders
export const getPendingOrdersSummary = createServerFn(
  { method: 'GET' },
  async () => {
    try {
      // Active reservations
      const activeReservations = await queryOne<{
        total_reserved: number;
        reservation_count: number;
      }>(
        `SELECT
          SUM(quantity) as total_reserved,
          COUNT(DISTINCT order_id) as reservation_count
         FROM stock_reservations
         WHERE status = 'active' AND expires_at > NOW()`
      );

      // Pending orders (awaiting payment)
      const pendingOrders = await query<{
        order_id: string;
        customer_name: string;
        gross_amount: number;
        created_at: string;
      }>(
        `SELECT order_id, customer_name, gross_amount, created_at
         FROM orders
         WHERE transaction_status = 'pending'
         ORDER BY created_at DESC
         LIMIT 20`
      );

      return {
        success: true,
        activeReservations: {
          total_reserved: activeReservations?.total_reserved || 0,
          reservation_count: activeReservations?.reservation_count || 0,
        },
        pendingOrders,
      };
    } catch (error) {
      console.error('Error fetching pending orders summary:', error);
      return {
        success: false,
        activeReservations: null,
        pendingOrders: [],
        error: 'Failed to fetch pending data',
      };
    }
  }
);

// ============ ERROR LOGGING & MONITORING ============

export interface SyncLog {
  id: number;
  sync_type: 'webhook' | 'polling' | 'manual' | 'error';
  order_id: string | null;
  product_id: number | null;
  quantity: number | null;
  status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  details: string | null;
  created_at: string;
  updated_at: string;
}

// Get recent sync logs
export const getSyncLogs = createServerFn(
  { method: 'GET' },
  async (limit: number = 50, status?: 'success' | 'failed' | 'pending') => {
    try {
      const whereClause = status ? 'WHERE status = ?' : '';
      const params = status ? [status] : [];

      const logs = await query<SyncLog>(
        `SELECT * FROM sync_logs ${whereClause} ORDER BY created_at DESC LIMIT ?`,
        [...params, limit]
      );

      return { success: true, logs };
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      return { success: false, logs: [], error: 'Failed to fetch sync logs' };
    }
  }
);

// Get sync error summary
export const getSyncErrorSummary = createServerFn(
  { method: 'GET' },
  async (hoursBack: number = 24) => {
    try {
      const summary = await queryOne<{
        total_errors: number;
        webhook_errors: number;
        polling_errors: number;
        recent_error: string | null;
      }>(
        `SELECT
          COUNT(*) as total_errors,
          SUM(CASE WHEN sync_type = 'webhook' THEN 1 ELSE 0 END) as webhook_errors,
          SUM(CASE WHEN sync_type = 'polling' THEN 1 ELSE 0 END) as polling_errors,
          MAX(error_message) as recent_error
         FROM sync_logs
         WHERE status = 'failed' AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [hoursBack]
      );

      return {
        success: true,
        summary: summary || {
          total_errors: 0,
          webhook_errors: 0,
          polling_errors: 0,
          recent_error: null,
        },
      };
    } catch (error) {
      console.error('Error fetching error summary:', error);
      return { success: false, summary: null, error: 'Failed to fetch error summary' };
    }
  }
);

// Get stock discrepancies (orders with payment but stock not reduced)
export const getStockDiscrepancies = createServerFn(
  { method: 'GET' },
  async () => {
    try {
      const discrepancies = await query<{
        order_id: string;
        customer_name: string;
        gross_amount: number;
        transaction_status: string;
        stock_reduced: boolean;
        created_at: string;
        minutes_since_created: number;
      }>(
        `SELECT 
          order_id,
          customer_name,
          gross_amount,
          transaction_status,
          stock_reduced,
          created_at,
          TIMESTAMPDIFF(MINUTE, created_at, NOW()) as minutes_since_created
         FROM orders
         WHERE (transaction_status = 'settlement' OR transaction_status = 'success') AND stock_reduced = FALSE
         ORDER BY created_at DESC`
      );

      return { success: true, discrepancies };
    } catch (error) {
      console.error('Error fetching stock discrepancies:', error);
      return { success: false, discrepancies: [], error: 'Failed to fetch discrepancies' };
    }
  }
);

// Get reservation status
export const getReservationStatus = createServerFn(
  { method: 'GET' },
  async () => {
    try {
      const byStatus = await query<{
        status: string;
        count: number;
        total_quantity: number;
      }>(
        `SELECT 
          status,
          COUNT(*) as count,
          SUM(quantity) as total_quantity
         FROM stock_reservations
         GROUP BY status`
      );

      const activeByProduct = await query<{
        product_id: number;
        product_name: string;
        reserved_quantity: number;
        current_stock: number;
      }>(
        `SELECT 
          sr.product_id,
          p.name as product_name,
          SUM(sr.quantity) as reserved_quantity,
          i.stock as current_stock
         FROM stock_reservations sr
         JOIN products p ON sr.product_id = p.id
         JOIN inventory i ON sr.product_id = i.product_id
         WHERE sr.status = 'active' AND sr.expires_at > NOW()
         GROUP BY sr.product_id`
      );

      return {
        success: true,
        byStatus,
        activeByProduct,
      };
    } catch (error) {
      console.error('Error fetching reservation status:', error);
      return {
        success: false,
        byStatus: [],
        activeByProduct: [],
        error: 'Failed to fetch reservation status',
      };
    }
  }
);
