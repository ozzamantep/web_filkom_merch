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

export interface Category {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface CreateSaleInput {
  admin_id: number;
  cashier_name?: string;
  payment_method: "cash" | "qris" | "debit";
  items: Array<{
    product_id: number;
    product_name: string;
    variant_id?: number;
    size?: string;
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

export interface OfflineSale {
  id: number;
  sale_id: string;
  admin_id: number | null;
  cashier_name: string | null;
  customer_name: string | null;
  payment_method: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  source: "offline";
  status: string;
  created_at: string;
}

export interface OfflineSaleItem {
  id: number;
  sale_id: string;
  product_id: number;
  product_name: string;
  variant_id: number | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface StoreSettings {
  id: number;
  store_name: string;
  address: string | null;
  phone: string | null;
  tax_rate: number;
  qris_static_url: string | null;
}

export interface CreateProductInput {
  category_id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active?: boolean;
  variants: Array<{ size: string; stock: number }>;
}

export interface UpdateProductInput extends CreateProductInput {
  id: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS Statis",
  debit: "Debit",
};

export const getCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: Category[]; error?: string }> => {
    try {
      const { query } = await import("./db/database");
      const categories = await query<Category>(
        "SELECT id, name, slug, is_active FROM categories WHERE is_active = TRUE ORDER BY name",
      );
      return { categories };
    } catch (error) {
      console.error("Error fetching categories:", error);
      return { categories: [], error: "Failed to fetch categories" };
    }
  },
);

export const getAllProductsAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: ProductWithVariants[]; error?: string }> => {
    try {
      const { query } = await import("./db/database");
      const products = await query<
        Product & { category_name?: string | null; category_slug?: string | null }
      >(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
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
      console.error("Error fetching admin products:", error);
      return { products: [], error: "Failed to fetch products" };
    }
  },
);

export const createProduct = createServerFn({ method: "POST" })
  .validator((d: CreateProductInput) => d)
  .handler(async ({ data: input }) => {
    try {
      const { execute } = await import("./db/database");
      const result = await execute(
        `INSERT INTO products (category_id, name, slug, description, price, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.category_id,
          input.name,
          input.slug,
          input.description || null,
          input.price,
          input.image_url || null,
          input.is_active ?? true,
        ],
      );
      for (const variant of input.variants) {
        await execute(
          "INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)",
          [result.insertId, variant.size, variant.stock],
        );
      }
      return { success: true, product_id: result.insertId };
    } catch (error) {
      console.error("Error creating product:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create product",
      };
    }
  });

export const updateProduct = createServerFn({ method: "POST" })
  .validator((d: UpdateProductInput) => d)
  .handler(async ({ data: input }) => {
    try {
      const { execute } = await import("./db/database");
      await execute(
        `UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?,
         price = ?, image_url = ?, is_active = ? WHERE id = ?`,
        [
          input.category_id,
          input.name,
          input.slug,
          input.description || null,
          input.price,
          input.image_url || null,
          input.is_active ?? true,
          input.id,
        ],
      );
      await execute("DELETE FROM product_variants WHERE product_id = ?", [input.id]);
      for (const variant of input.variants) {
        await execute(
          "INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)",
          [input.id, variant.size, variant.stock],
        );
      }
      return { success: true };
    } catch (error) {
      console.error("Error updating product:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update product",
      };
    }
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    try {
      const { execute } = await import("./db/database");
      await execute("UPDATE products SET is_active = FALSE WHERE id = ?", [id]);
      return { success: true };
    } catch (error) {
      console.error("Error deleting product:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete product",
      };
    }
  });

export const createSale = createServerFn({ method: "POST" })
  .validator((d: CreateSaleInput) => d)
  .handler(async ({ data: input }) => {
    try {
      const { execute, queryOne, getConnection } = await import("./db/database");
      const saleId = `POS-${Date.now()}`;
      const paymentLabel = PAYMENT_LABELS[input.payment_method] || input.payment_method;

      const connection = await getConnection();
      try {
        await connection.beginTransaction();

        await connection.execute(
          `INSERT INTO offline_sales (
            sale_id, admin_id, cashier_name, customer_name, payment_method,
            subtotal, discount, tax, total, notes, source, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', 'completed')`,
          [
            saleId,
            input.admin_id || null,
            input.cashier_name || null,
            input.customer_name || null,
            paymentLabel,
            input.subtotal,
            input.discount,
            input.tax,
            input.total,
            input.notes || null,
          ],
        );

        for (const item of input.items) {
          const subtotal = item.unit_price * item.quantity - item.discount;
          await connection.execute(
            `INSERT INTO offline_sale_items (
              sale_id, product_id, product_name, variant_id, size,
              quantity, unit_price, discount, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              item.product_id,
              item.product_name,
              item.variant_id || null,
              item.size || null,
              item.quantity,
              item.unit_price,
              item.discount,
              subtotal,
            ],
          );

          if (item.variant_id) {
            const [stockRows] = await connection.execute(
              "SELECT stock FROM product_variants WHERE id = ? FOR UPDATE",
              [item.variant_id],
            );
            const stockRow = (stockRows as { stock: number }[])[0];
            if (!stockRow || stockRow.stock < item.quantity) {
              throw new Error(`Stok tidak cukup untuk ${item.product_name}`);
            }
            await connection.execute(
              "UPDATE product_variants SET stock = stock - ? WHERE id = ?",
              [item.quantity, item.variant_id],
            );
          } else {
            const [variants] = await connection.execute(
              "SELECT id, stock FROM product_variants WHERE product_id = ? ORDER BY id LIMIT 1 FOR UPDATE",
              [item.product_id],
            );
            const variant = (variants as { id: number; stock: number }[])[0];
            if (!variant || variant.stock < item.quantity) {
              throw new Error(`Stok tidak cukup untuk ${item.product_name}`);
            }
            await connection.execute(
              "UPDATE product_variants SET stock = stock - ? WHERE id = ?",
              [item.quantity, variant.id],
            );
          }
        }

        await connection.commit();

        const inserted = await queryOne<{ id: number }>(
          "SELECT id FROM offline_sales WHERE sale_id = ?",
          [saleId],
        );

        return {
          success: true,
          sale_id: saleId,
          db_id: inserted?.id ?? 0,
          message: "Sale created successfully",
        };
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error creating sale:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create sale",
      };
    }
  });

export const getOfflineSales = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ sales: OfflineSale[]; error?: string }> => {
    try {
      const { query } = await import("./db/database");
      const sales = await query<OfflineSale>(
        "SELECT * FROM offline_sales WHERE source = 'offline' ORDER BY created_at DESC LIMIT 100",
      );
      return { sales };
    } catch (error) {
      console.error("Error fetching offline sales:", error);
      return { sales: [], error: "Failed to fetch offline sales" };
    }
  },
);

export const getOnlineOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: Order[]; error?: string }> => {
    try {
      const { query } = await import("./db/database");
      const orders = await query<Order>(
        "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
      );
      return { orders };
    } catch (error) {
      console.error("Error fetching online orders:", error);
      return { orders: [], error: "Failed to fetch orders" };
    }
  },
);

export const getStoreSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ settings: StoreSettings | null; error?: string }> => {
    try {
      const { queryOne } = await import("./db/database");
      const settings = await queryOne<StoreSettings>("SELECT * FROM store_settings LIMIT 1");
      return {
        settings: settings ?? {
          id: 0,
          store_name: "FILKOM Merch",
          address: null,
          phone: null,
          tax_rate: 0,
          qris_static_url: null,
        },
      };
    } catch (error) {
      console.error("Error fetching store settings:", error);
      return { settings: null, error: "Failed to fetch settings" };
    }
  },
);

export const updateStoreSettings = createServerFn({ method: "POST" })
  .validator(
    (d: {
      store_name: string;
      address?: string;
      phone?: string;
      tax_rate?: number;
      qris_static_url?: string;
    }) => d,
  )
  .handler(async ({ data: input }) => {
    try {
      const { execute, queryOne } = await import("./db/database");
      const existing = await queryOne<{ id: number }>("SELECT id FROM store_settings LIMIT 1");
      if (existing) {
        await execute(
          `UPDATE store_settings SET store_name = ?, address = ?, phone = ?,
           tax_rate = ?, qris_static_url = ? WHERE id = ?`,
          [
            input.store_name,
            input.address || null,
            input.phone || null,
            input.tax_rate ?? 0,
            input.qris_static_url || null,
            existing.id,
          ],
        );
      } else {
        await execute(
          `INSERT INTO store_settings (store_name, address, phone, tax_rate, qris_static_url)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.store_name,
            input.address || null,
            input.phone || null,
            input.tax_rate ?? 0,
            input.qris_static_url || null,
          ],
        );
      }
      return { success: true };
    } catch (error) {
      console.error("Error updating store settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
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
      const { queryOne } = await import("./db/database");
      const summary = await queryOne<DailySummary>(
        `SELECT
          COUNT(*) AS total_transactions,
          COALESCE(SUM(total), 0) AS total_revenue,
          COALESCE(SUM(discount), 0) AS total_discount,
          COALESCE(AVG(total), 0) AS avg_transaction
         FROM offline_sales
         WHERE source = 'offline' AND DATE(created_at) = ?`,
        [date],
      );
      return {
        success: true,
        summary: summary ?? {
          total_transactions: 0,
          total_revenue: 0,
          total_discount: 0,
          avg_transaction: 0,
        },
      };
    } catch (error) {
      console.error("Error fetching daily summary:", error);
      return { success: false, summary: null, error: "Failed to fetch summary" };
    }
  });

export const getTopProducts = createServerFn({ method: "GET" })
  .validator((d: { limit?: number; days?: number } | undefined) => d)
  .handler(async ({ data }) => {
    try {
      const { query } = await import("./db/database");
      const limit = data?.limit ?? 10;
      const days = data?.days ?? 30;
      const products = await query<TopProduct>(
        `SELECT p.id, p.name,
          COALESCE(SUM(osi.quantity), 0) AS total_quantity_sold,
          COALESCE(SUM(osi.subtotal), 0) AS total_revenue
         FROM offline_sale_items osi
         JOIN products p ON p.id = osi.product_id
         JOIN offline_sales os ON os.sale_id = osi.sale_id
         WHERE os.source = 'offline' AND os.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY p.id, p.name
         ORDER BY total_quantity_sold DESC
         LIMIT ?`,
        [days, limit],
      );
      return { success: true, products };
    } catch (error) {
      console.error("Error fetching top products:", error);
      return { success: false, products: [], error: "Failed to fetch products" };
    }
  });

export const getInventory = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { query } = await import("./db/database");
    const rows = await query<{
      id: number;
      product_id: number;
      product_name: string;
      product_price: number;
      stock: number;
    }>(
      `SELECT pv.id, pv.product_id, p.name AS product_name, p.price AS product_price, pv.stock
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE p.is_active = TRUE
       ORDER BY p.name, pv.size`,
    );
    const inventory: InventoryItem[] = rows.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_name: `${row.product_name}`,
      product_price: Number(row.product_price),
      stock: row.stock,
      min_stock: 5,
      status: row.stock <= 0 ? "out" : row.stock <= 5 ? "low" : "ok",
    }));
    return { success: true, inventory };
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return { success: false, inventory: [], error: "Failed to fetch inventory" };
  }
});
