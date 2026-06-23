import { createAPIFileRoute } from '@tanstack/react-start/api';
import { execute, query, queryOne } from '../../lib/database';
import crypto from 'crypto';
import { config } from '../../lib/config';

const midtransServerKey = config.midtrans.serverKey;

// Verify Midtrans webhook signature
function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signature: string
): boolean {
  const signatureKey = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${midtransServerKey}`)
    .digest('hex');

  return signatureKey === signature;
}

// Log sync operation
async function logSync(
  syncType: 'webhook' | 'polling',
  orderId: string | null,
  productId: number | null,
  quantity: number | null,
  status: 'success' | 'failed' | 'pending',
  errorMessage?: string,
  details?: Record<string, any>
) {
  try {
    await execute(
      `INSERT INTO sync_logs (sync_type, order_id, product_id, quantity, status, error_message, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        syncType,
        orderId,
        productId,
        quantity,
        status,
        errorMessage || null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (error) {
    console.error('Error logging sync:', error);
  }
}

// Handle online order payment confirmation from Midtrans
async function handleMidtransPayment(payload: {
  order_id: string;
  status_code: string;
  transaction_status: string;
  gross_amount: string;
  signature_key: string;
  transaction_id?: string;
  settlement_time?: string;
}) {
  try {
    // Verify signature for security
    if (!verifyMidtransSignature(payload.order_id, payload.status_code, payload.gross_amount, payload.signature_key)) {
      await logSync('webhook', payload.order_id, null, null, 'failed', 'Invalid signature');
      return { success: false, error: 'Invalid signature' };
    }

    // Check if order exists
    const order = await queryOne(
      `SELECT id, order_id, transaction_status, stock_reduced FROM orders WHERE order_id = ?`,
      [payload.order_id]
    );

    if (!order) {
      await logSync('webhook', payload.order_id, null, null, 'failed', 'Order not found');
      return { success: false, error: 'Order not found' };
    }

    // If stock already reduced, skip
    if (order.stock_reduced) {
      await logSync('webhook', payload.order_id, null, null, 'success', 'Stock already reduced');
      return { success: true, message: 'Stock already reduced, skipping' };
    }

    // Update order transaction status
    await execute(
      `UPDATE orders SET transaction_status = ?, midtrans_transaction_id = ?, updated_at = NOW() WHERE order_id = ?`,
      [payload.transaction_status, payload.transaction_id || null, payload.order_id]
    );

    // Only reduce stock if payment is settled/success
    if (
      payload.transaction_status === 'settlement' ||
      payload.transaction_status === 'success' ||
      payload.status_code === '200'
    ) {
      // Get all order items
      const orderItems = await query<{ product_id: number; quantity: number }>(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
        [payload.order_id]
      );

      // For each item, reduce inventory and log
      for (const item of orderItems) {
        if (item.product_id) {
          // Reduce inventory
          await execute(
            'UPDATE inventory SET stock = stock - ? WHERE product_id = ?',
            [item.quantity, item.product_id]
          );

          // Log to stock history
          await execute(
            `INSERT INTO stock_history (product_id, type, quantity, reference_id, reference_type)
             VALUES (?, ?, ?, ?, ?)`,
            [item.product_id, 'out', item.quantity, payload.order_id, 'online']
          );

          await logSync('webhook', payload.order_id, item.product_id, item.quantity, 'success');
        }
      }

      // Mark order as stock_reduced
      await execute(`UPDATE orders SET stock_reduced = TRUE WHERE order_id = ?`, [payload.order_id]);

      // Complete/delete reservations for this order
      await execute(
        `UPDATE stock_reservations SET status = 'completed' WHERE order_id = ?`,
        [payload.order_id]
      );

      return {
        success: true,
        message: 'Payment confirmed and stock reduced',
        itemsProcessed: orderItems.length,
      };
    } else if (
      payload.transaction_status === 'cancel' ||
      payload.transaction_status === 'expire' ||
      payload.transaction_status === 'deny'
    ) {
      // Payment failed, release reservations
      await execute(
        `UPDATE stock_reservations SET status = 'cancelled' WHERE order_id = ?`,
        [payload.order_id]
      );

      await logSync('webhook', payload.order_id, null, null, 'success', `Payment ${payload.transaction_status}`);

      return {
        success: true,
        message: `Payment ${payload.transaction_status}, reservations released`,
      };
    }

    return { success: true, message: 'Webhook processed' };
  } catch (error) {
    console.error('Error handling webhook:', error);
    await logSync(
      'webhook',
      payload.order_id,
      null,
      null,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process webhook',
    };
  }
}

// Main webhook endpoint
export const GET = createAPIFileRoute(async (req) => {
  return new Response(JSON.stringify({ message: 'Webhook endpoint active' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

export const POST = createAPIFileRoute(async (req) => {
  try {
    const body = await req.json();

    // Determine webhook source based on payload structure
    if (body.order_id && body.status_code !== undefined) {
      // Midtrans webhook
      const result = await handleMidtransPayment(body);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
