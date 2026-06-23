import { createServerFn } from '@tanstack/react-start';
import { config } from './config';

// ============ PRODUCT ACTIONS ============

export interface Product {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  size: string;
  stock: number;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

// Get all products
export const getProducts = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    // GET requests don't typically have data, but validator is required
    return data;
  })
  .handler(
    async (): Promise<{ products: ProductWithVariants[]; error?: string }> => {
      try {
        // Import database functions only on server
        const { query } = await import('./database');
        
        const products = await query<Product>(
          'SELECT * FROM products WHERE is_active = TRUE ORDER BY id DESC'
        );

        const productsWithVariants = await Promise.all(
          products.map(async (product) => {
            const variants = await query<ProductVariant>(
              'SELECT * FROM product_variants WHERE product_id = ?',
              [product.id]
            );
            return { ...product, variants };
          })
        );

        return { products: productsWithVariants };
      } catch (error) {
      console.error('Error fetching products:', error);
      return { products: [], error: 'Failed to fetch products' };
    }
  }
);

// ============ ORDER ACTIONS ============

export interface Order {
  id: number;
  order_id: string;
  user_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
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
  product_name: string;
  size: string;
  quantity: number;
  price: number;
  subtotal: number;
}

// Create order and payment
export interface TransactionDetails {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  userId?: number;
}

// New Payment & Order Processing
export const createPaymentAndOrder = createServerFn({ method: 'POST' })(
  async (details: TransactionDetails) => {
    try {
      // Import database functions only on server
      const { execute, queryOne, query } = await import('./database');
      
      // DEBUG: Log everything
      console.log('═══════════════════════════════════════════');
      console.log('🔄 [createPaymentAndOrder] SERVER FUNCTION EXECUTING');
      console.log('📋 Details received:', {
        orderId: details.orderId,
        amount: details.grossAmount,
        customer: details.customerName,
        itemsCount: details.items.length
      });
      console.log('🔑 MIDTRANS_SERVER_KEY exists:', !!config.midtrans.serverKey);
      console.log('🔑 MIDTRANS_SERVER_KEY length:', config.midtrans.serverKey?.length || 0);
      console.log('═══════════════════════════════════════════');
      
      const midtransServerKey = config.midtrans.serverKey;
      const merchantId = 'M034219320';

      if (!midtransServerKey) {
        throw new Error('MIDTRANS_SERVER_KEY not configured in .env.local');
      }

      // 1. Insert order ke database
      console.log('📝 Inserting order to database...');
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

      // 2. Insert order items & reserve stock
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

        // Check stock & reserve
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
            console.error(`❌ Insufficient stock for product ${product.id}`);
            throw new Error(`Insufficient stock for ${item.name}`);
          }

          // Reserve stock
          await execute(
            `INSERT INTO stock_reservations (order_id, product_id, size, quantity, expires_at, status)
             VALUES (?, ?, ?, ?, ?, 'active')`,
            [details.orderId, product.id, 'One Size', item.quantity, expiresAt]
          );
          console.log(`✅ Reserved ${item.quantity} of product ${product.id}`);
        }
      }

      // 3. Generate Midtrans QRIS
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

        // Cleanup
        await execute(
          'UPDATE stock_reservations SET status = ? WHERE order_id = ?',
          ['cancelled', details.orderId]
        );

        throw new Error(`Midtrans error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Midtrans QRIS generated');

      // 4. Update order with token
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
      console.error('❌ [createPaymentAndOrder] Error:', msg);
      console.error('📍 Stack:', error instanceof Error ? error.stack : 'N/A');
      return { success: false, error: msg };
    }
  }
);

// Get order by ID
export const getOrderById = createServerFn({ method: 'GET' })(
  async (
    orderId: string
  ): Promise<{ success: boolean; order?: Order; items?: OrderItem[]; error?: string }> => {
    try {
      // Import database functions only on server
      const { queryOne, query } = await import('./database');
      
      const order = await queryOne<Order>('SELECT * FROM orders WHERE order_id = ?', [orderId]);

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      const items = await query<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [
        orderId,
      ]);

      return { success: true, order, items };
    } catch (error) {
      console.error('Error fetching order:', error);
      return { success: false, error: 'Failed to fetch order' };
    }
  }
);
