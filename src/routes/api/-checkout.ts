import { type TransactionDetails } from "@backend/services/midtrans";
import { execute } from "@backend/db/database";
import { config } from "@backend/config/config";

const midtransServerKey = config.midtrans.serverKey;
const merchantId = "M934219320";

export async function createQrisPayment(details: TransactionDetails) {
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

  try {
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
      console.error("Midtrans error:", error);
      throw new Error(`Midtrans API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      token: data.token,
      redirect_url: data.redirect_url,
    };
  } catch (error) {
    console.error("Payment creation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create payment",
    };
  }
}

// Create order di database dan generate QRIS payment
export async function createOrderAndPayment(details: TransactionDetails & { userId?: number }) {
  try {
    // 1. Insert order ke database
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

    // 2. Insert order items
    for (const item of details.items) {
      await execute(
        `INSERT INTO order_items (
          order_id, product_id, product_name, size, quantity, price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          details.orderId,
          null,
          item.name,
          "One Size",
          item.quantity,
          item.price,
          item.price * item.quantity,
        ],
      );
    }

    // 3. Generate QRIS payment
    const paymentResult = await createQrisPayment(details);

    if (!paymentResult.success) {
      throw new Error("Failed to generate QRIS payment");
    }

    // 4. Update order dengan snap token
    await execute("UPDATE orders SET snap_token = ?, payment_type = ? WHERE order_id = ?", [
      paymentResult.token,
      "qris",
      details.orderId,
    ]);

    return {
      success: true,
      orderId: details.orderId,
      token: paymentResult.token,
      qrUrl: `https://app.sandbox.midtrans.com/qris/${paymentResult.token}.png`,
    };
  } catch (error) {
    console.error("Error creating order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create order",
    };
  }
}
