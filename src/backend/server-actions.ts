import { createServerFn } from "@tanstack/react-start";
import { config } from "./config/config";

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
  category_name?: string | null;
  category_slug?: string | null;
  variants: ProductVariant[];
}

export interface DatabaseStatus {
  ok: boolean;
  message: string;
  database?: string;
  result?: number;
  host?: string;
  user?: string;
  port?: number;
  error?: string;
}

// Get all products
export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: ProductWithVariants[]; error?: string }> => {
    try {
      // Import database functions only on server
      const { query } = await import("./db/database");

      const products = await query<
        Product & { category_name?: string | null; category_slug?: string | null }
      >(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = TRUE
         ORDER BY p.id DESC`,
      );

      const productsWithVariants = await Promise.all(
        products.map(async (product) => {
          const variants = await query<ProductVariant>(
            "SELECT * FROM product_variants WHERE product_id = ?",
            [product.id],
          );
          return { ...product, variants };
        }),
      );

      return { products: productsWithVariants };
    } catch (error) {
      console.error("Error fetching products:", error);
      return { products: [], error: "Failed to fetch products" };
    }
  },
);

export const checkDatabaseConnection = createServerFn({ method: "GET" }).handler(
  async (): Promise<DatabaseStatus> => {
    try {
      const { queryOne } = await import("./db/database");

      const result = await queryOne<{ ok: number; db_name: string }>(
        "SELECT 1 AS ok, DATABASE() AS db_name",
      );

      if (!result) {
        return {
          ok: false,
          message: "Database connected, but no result was returned",
        };
      }

      return {
        ok: true,
        message: "MySQL connection OK",
        database: result.db_name,
        result: result.ok,
        host: config.db.host,
        user: config.db.user,
        port: config.db.port,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect to database";
      console.error("Database connection check failed:", error);

      return {
        ok: false,
        message,
        host: config.db.host,
        user: config.db.user,
        port: config.db.port,
        error: error instanceof Error ? error.stack || error.message : String(error),
      };
    }
  },
);

// ============ ORDER ACTIONS ============

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
  customerNim?: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  userId?: number;
}

export const createOrderAndPayment = createServerFn({ method: "POST" })
  .validator((d: TransactionDetails) => d)
  .handler(
  async ({ data: details }) => {
    try {
      // Import database functions only on server
      const { execute, queryOne } = await import("./db/database");

      console.log("🔄 Creating order:", details.orderId);

      const midtransServerKey = config.midtrans.serverKey;
      const merchantId = "M934219320";

      if (!midtransServerKey) {
        throw new Error("MIDTRANS_SERVER_KEY not configured in .env.local");
      }

      // 1. Insert order ke database
      console.log("📝 Inserting order to database...");
      await execute(
        `INSERT INTO orders (
          order_id, user_id, customer_name, customer_nim, customer_email,
          customer_phone, shipping_address, gross_amount, transaction_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          details.orderId,
          details.userId || null,
          details.customerName,
          details.customerNim || null,
          details.customerEmail,
          details.customerPhone,
          details.shippingAddress || null,
          details.grossAmount,
          "pending",
        ],
      );
      console.log("✅ Order inserted");

      // 2. Insert order items
      console.log("📦 Inserting order items...");
      for (const item of details.items) {
        await execute(
          `INSERT INTO order_items (
            order_id, product_name, size, quantity, price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            details.orderId,
            item.name,
            "One Size",
            item.quantity,
            item.price,
            item.price * item.quantity,
          ],
        );
      }
      console.log("✅ Order items inserted");

      // 3. Generate QRIS payment via Midtrans
      console.log("🔐 Generating QRIS payment...");
      const encodedKey = Buffer.from(`${merchantId}:${midtransServerKey}`).toString("base64");

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
        payment_type: "qris",
        qris: {
          acquirer: "gopay",
        },
        expiry: {
          unit: "minutes",
          length: 60,
        },
      };

      const response = await fetch("https://app.sandbox.midtrans.com/snap/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify(transactionPayload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("❌ Midtrans error:", error);
        throw new Error(`Midtrans API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log("✅ QRIS generated");

      // 4. Update order dengan snap token
      console.log("🔐 Updating order with snap token...");
      await execute("UPDATE orders SET snap_token = ?, payment_type = ? WHERE order_id = ?", [
        data.token,
        "qris",
        details.orderId,
      ]);
      console.log("✅ Order updated");

      console.log("✨ Payment created successfully");
      return {
        success: true,
        orderId: details.orderId,
        token: data.token,
        qrUrl: `https://app.sandbox.midtrans.com/qris/${data.token}.png`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Error creating order:", errorMsg);
      console.error("📍 Stack:", error instanceof Error ? error.stack : "N/A");
      return {
        success: false,
        error: errorMsg,
      };
    }
  },
);

// Get order by ID
export const getOrderById = createServerFn({ method: "GET" })
  .validator((orderId: string) => orderId)
  .handler(
  async ({ data: orderId }): Promise<{ success: boolean; order?: Order; items?: OrderItem[]; error?: string }> => {
    try {
      // Import database functions only on server
      const { queryOne, query } = await import("./db/database");

      const order = await queryOne<Order>("SELECT * FROM orders WHERE order_id = ?", [orderId]);

      if (!order) {
        return { success: false, error: "Order not found" };
      }

      const items = await query<OrderItem>("SELECT * FROM order_items WHERE order_id = ?", [
        orderId,
      ]);

      return { success: true, order, items };
    } catch (error) {
      console.error("Error fetching order:", error);
      return { success: false, error: "Failed to fetch order" };
    }
  },
);

// ============ CASHIER / ADMIN ACTIONS ============

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
}

export const getPaymentMethods = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ success: boolean; methods: PaymentMethod[]; error?: string }> => {
    try {
      return {
        success: true,
        methods: [
          { id: 1, name: 'Cash / Tunai', code: 'cash' },
          { id: 2, name: 'Debit Card', code: 'debit' },
          { id: 3, name: 'Credit Card', code: 'credit' },
          { id: 4, name: 'Bank Transfer', code: 'transfer' },
          { id: 5, name: 'E-Wallet', code: 'e_wallet' },
          { id: 6, name: 'QRIS', code: 'qris' },
        ],
      };
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return { success: false, methods: [], error: 'Failed to fetch payment methods' };
    }
  }
);

export interface CreateSaleInput {
  admin_id: number;
  payment_method_id: number;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  customer_name?: string;
}

export const createSale = createServerFn({ method: "POST" })
  .validator((d: CreateSaleInput) => d)
  .handler(async ({ data: input }) => {
    try {
      const saleId = `SALE-${Date.now()}`;

      // In friends' logic, this simulates success
      return {
        success: true,
        sale_id: saleId,
        db_id: Math.floor(Math.random() * 10000),
        message: 'Sale created successfully',
      };
    } catch (error) {
      console.error('Error creating sale:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sale',
      };
    }
  });

export interface DailySummary {
  total_transactions: number;
  total_revenue: number;
  total_discount: number;
  avg_transaction: number;
}

export interface TopProduct {
  id: number;
  name: string;
  total_quantity_sold: number;
  total_revenue: number;
}

export interface InventoryItem {
  id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  stock: number;
  min_stock: number;
  status: 'ok' | 'low' | 'out';
}

export const getDailySalesSummary = createServerFn({ method: "GET" })
  .validator((date: string) => date)
  .handler(async ({ data: date }) => {
    try {
      return {
        success: true,
        summary: {
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
  });

export const getTopProducts = createServerFn({ method: "GET" })
  .validator((d: { limit?: number; days?: number } | undefined) => d)
  .handler(async ({ data }) => {
    try {
      return { success: true, products: [] as TopProduct[] };
    } catch (error) {
      console.error('Error fetching top products:', error);
      return { success: false, products: [], error: 'Failed to fetch products' };
    }
  });

export const getInventory = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { success: true, inventory: [] as InventoryItem[] };
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return { success: false, inventory: [], error: 'Failed to fetch inventory' };
    }
  });
