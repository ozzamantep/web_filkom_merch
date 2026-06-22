// Midtrans configuration for Sandbox
export const MIDTRANS_CONFIG = {
  isProduction: false,
  clientKey: "YOUR_MIDTRANS_SERVER_KEY",
  serverKey: "YOUR_MIDTRANS_SERVER_KEY",
  merchantId: "M934219320",
  snapUrl: "https://app.sandbox.midtrans.com/snap/snap.js",
};

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface TransactionDetails {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerNim?: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress?: string;
  items: CartItem[];
}

export interface MidtransResponse {
  token: string;
  redirect_url: string;
}

export interface PaymentResult {
  status: "success" | "pending" | "failed";
  transactionId?: string;
  orderId?: string;
  message?: string;
}
