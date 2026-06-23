import { createServerFn } from '@tanstack/react-start';

interface PaymentRequest {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  userId?: number;
}

export const processPayment = createServerFn({ method: 'POST' })(
  async (details: PaymentRequest) => {
    try {
      // Dynamic imports to prevent module externalization
      const { execute, queryOne, query } = await import('../../lib/database');
      const { config } = await import('../../lib/config');

      console.log('═══════════════════════════════════════════');
      console.log('🔄 [processPayment] ROUTE SERVER FUNCTION EXECUTING!');
      console.log('📋 Order:', details.orderId, 'Amount:', details.grossAmount);
      console.log('🔑 Server Key exists:', !!config.midtrans.serverKey);
      console.log('═══════════════════════════════════════════');

      const midtransServerKey = config.midtrans.serverKey;
      const merchantId = 'M034219320';

      if (!midtransServerKey) {
        throw new Error('MIDTRANS_SERVER_KEY not configured');
      }

      // 1. Insert order
      console.log('📝 Inserting order...');
      await execute(
        `INSERT INTO orders (
          order_id, user_id, customer_name, customer_email, 
          customer_phone, gross_amount, transaction_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          details.orderId,
          details.userId || null,
          details.customerName,
          details.customerEmail,
          details.customerPhone,
          details.grossAmount,
          'pending',
        ]
      );
      console.log('✅ Order inserted');

      // 2. Process items & reserve stock
      console.log('📦 Processing items...');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      for (const item of details.items) {
        const product = await queryOne<{ id: number }>(
          'SELECT id FROM products WHERE name = ? LIMIT 1',
          [item.name]
        );

        await execute(
          `INSERT INTO order_items (
            order_id, product_id, product_name, size, quantity, price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            details.orderId,
            product?.id || null,
            item.name,
            'One Size',
            item.quantity,
            item.price,
            item.price * item.quantity,
          ]
        );

        if (product?.id) {
          const stock = await queryOne<{ stock: number }>(
            'SELECT stock FROM inventory WHERE product_id = ?',
            [product.id]
          );

          const reserved = await queryOne<{ reserved: number }>(
            `SELECT COALESCE(SUM(quantity), 0) as reserved 
             FROM stock_reservations 
             WHERE product_id = ? AND status = 'active' AND expires_at > NOW()`,
            [product.id]
          );

          const available = (stock?.stock || 0) - (reserved?.reserved || 0);

          if (available < item.quantity) {
            console.error(`❌ Insufficient stock for ${item.name}`);
            throw new Error(`Insufficient stock for ${item.name}`);
          }

          await execute(
            `INSERT INTO stock_reservations (order_id, product_id, size, quantity, expires_at, status)
             VALUES (?, ?, ?, ?, ?, 'active')`,
            [details.orderId, product.id, 'One Size', item.quantity, expiresAt]
          );
          console.log(`✅ Reserved ${item.quantity} of ${item.name}`);
        }
      }

      // 3. Call Midtrans
      console.log('🔐 Calling Midtrans API...');
      const encodedKey = Buffer.from(`${merchantId}:${midtransServerKey}`).toString('base64');

      const payload = {
        transaction_details: {
          order_id: details.orderId,
          gross_amount: details.grossAmount,
        },
        customer_details: {
          first_name: details.customerName,
          email: details.customerEmail,
          phone: details.customerPhone,
        },
        item_details: details.items.map((item) => ({
          id: item.id,
          price: item.price,
          quantity: item.quantity,
          name: item.name,
        })),
        payment_type: 'qris',
        qris: { acquirer: 'gopay' },
        expiry: { unit: 'minutes', length: 60 },
      };

      const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${encodedKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Midtrans error:', errorText);
        throw new Error(`Midtrans error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ QRIS generated:', data.token);

      // 4. Update order
      await execute(
        'UPDATE orders SET snap_token = ?, payment_type = ? WHERE order_id = ?',
        [data.token, 'qris', details.orderId]
      );

      console.log('✨ Payment created successfully');
      return {
        success: true,
        orderId: details.orderId,
        token: data.token,
        qrUrl: `https://app.sandbox.midtrans.com/qris/${data.token}.png`,
      };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Server error';
      console.error('❌ [processPayment] Error:', msg);
      return { success: false, error: msg };
    }
  }
);
