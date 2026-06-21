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
export const getProducts = createServerFn(
  { method: 'GET' },
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

export const createOrderAndPayment = createServerFn(
  { method: 'POST' },
  async (details: TransactionDetails) => {
    try {
      // Import database functions only on server
      const { execute, queryOne } = await import('./database');
      
      console.log('🔄 Creating order:', details.orderId);
      
      const midtransServerKey = config.midtrans.serverKey;
      const merchantId = 'M934219320';

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

      // 2. Insert order items
      console.log('📦 Inserting order items...');
      for (const item of details.items) {
        await execute(
          `INSERT INTO order_items (
            order_id, product_name, size, quantity, price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            details.orderId,
            item.name,
            'One Size',
            item.quantity,
            item.price,
            item.price * item.quantity,
          ]
        );
      }
      console.log('✅ Order items inserted');

      // 3. Generate QRIS payment via Midtrans
      console.log('🔐 Generating QRIS payment...');
      const encodedKey = Buffer.from(`${merchantId}:${midtransServerKey}`).toString('base64');

      const transactionPayload = {
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
        qris: {
          acquirer: 'gopay',
        },
        expiry: {
          unit: 'minutes',
          length: 60,
        },
      };

      const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${encodedKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(transactionPayload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Midtrans error:', error);
        throw new Error(`Midtrans API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('✅ QRIS generated');

      // 4. Update order dengan snap token
      console.log('🔐 Updating order with snap token...');
      await execute(
        'UPDATE orders SET snap_token = ?, payment_type = ? WHERE order_id = ?',
        [data.token, 'qris', details.orderId]
      );
      console.log('✅ Order updated');

      console.log('✨ Payment created successfully');
      return {
        success: true,
        orderId: details.orderId,
        token: data.token,
        qrUrl: `https://app.sandbox.midtrans.com/qris/${data.token}.png`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error creating order:', errorMsg);
      console.error('📍 Stack:', error instanceof Error ? error.stack : 'N/A');
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
);

// Get order by ID
export const getOrderById = createServerFn(
  { method: 'GET' },
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
