import { createServerFn } from '@tanstack/react-start';
import { execute, queryOne, query } from '../../lib/database';

// Interface untuk Order
export interface Order {
  id: number;
  order_id: string;
  user_id: number | null;
  customer_name: string;
  customer_nim: string | null;
  customer_email: string;
  customer_phone: string;
  shipping_address: string | null;
  gross_amount: number;
  payment_type: string | null;
  transaction_status: string;
  midtrans_transaction_id: string | null;
  snap_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: string;
  product_id: number | null;
  product_name: string;
  size: string;
  quantity: number;
  price: number;
  subtotal: number;
}

// Get order by order_id
export const getOrderById = createServerFn(
  { method: 'GET' },
  async (orderId: string): Promise<{ order: Order; items: OrderItem[] } | null> => {
    try {
      const order = await queryOne<Order>(
        'SELECT * FROM orders WHERE order_id = ?',
        [orderId]
      );

      if (!order) return null;

      const items = await query<OrderItem>(
        'SELECT * FROM order_items WHERE order_id = ?',
        [orderId]
      );

      return { order, items };
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }
);

// Update order payment status (untuk webhook Midtrans)
export const updateOrderPaymentStatus = createServerFn(
  { method: 'POST' },
  async (
    orderId: string,
    status: string,
    midtransTransactionId: string,
    paymentType: string
  ) => {
    try {
      await execute(
        `UPDATE orders 
         SET transaction_status = ?, midtrans_transaction_id = ?, payment_type = ?
         WHERE order_id = ?`,
        [status, midtransTransactionId, paymentType, orderId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating order status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update order' };
    }
  }
);

// Get order history (untuk user)
export const getOrderHistory = createServerFn(
  { method: 'GET' },
  async (userId: number): Promise<Order[]> => {
    try {
      const orders = await query<Order>(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      return orders;
    } catch (error) {
      console.error('Error fetching order history:', error);
      return [];
    }
  }
);
