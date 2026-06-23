import { createServerFn } from '@tanstack/react-start';

// These are client-side functions that will call the backend API
// The actual database logic happens in the backend

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

// Get daily sales summary
export const getDailySalesSummary = async (date: string) => {
  try {
    // For now, return empty data since we don't have a backend yet
    // In production, this would call an actual API endpoint
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
};

// Get top selling products
export const getTopProducts = async (limit: number = 10, days: number = 30) => {
  try {
    // For now, return empty data
    return { success: true, products: [] };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { success: false, products: [], error: 'Failed to fetch products' };
  }
};

// Get inventory
export const getInventory = async () => {
  try {
    // For now, return empty data
    return { success: true, inventory: [] };
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return { success: false, inventory: [], error: 'Failed to fetch inventory' };
  }
};

// Get payment methods
export const getPaymentMethods = async () => {
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
};

// Create sale
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

export const createSale = async (input: CreateSaleInput) => {
  try {
    const saleId = `SALE-${Date.now()}`;

    // For now, just simulate success
    // In production, this would call an actual API endpoint
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
};
