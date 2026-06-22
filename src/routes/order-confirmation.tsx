import { createFileRoute, useSearch } from "@tanstack/react-router";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";

interface OrderConfirmationSearch {
  orderId?: string;
}

export const Route = createFileRoute("/order-confirmation")({
  validateSearch: (search: Record<string, unknown>): OrderConfirmationSearch => ({
    orderId: search.orderId as string | undefined,
  }),
  component: OrderConfirmationPage,
  head: () => ({
    meta: [
      { title: "Order Confirmed — Filkom Merch UB" },
      { name: "description", content: "Your order has been confirmed" },
    ],
  }),
});

function OrderConfirmationPage() {
  const search = useSearch({ from: "/order-confirmation" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <a href="/">
                <ArrowLeft className="h-5 w-5" />
              </a>
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Order Confirmation</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-3xl font-bold text-foreground">Thank You!</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Your payment has been received and we're processing your order.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="break-all font-mono text-sm font-semibold">{search.orderId || "N/A"}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">What's Next?</p>
                <ul className="mt-2 space-y-1 text-sm text-blue-800">
                  <li>✓ Order confirmation sent to email</li>
                  <li>✓ Item will be prepared for shipment</li>
                  <li>✓ You'll receive tracking info</li>
                </ul>
              </div>

              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Need Help?</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  <li>📧 support@filkommerch.ub</li>
                  <li>📱 WhatsApp Support</li>
                  <li>🕐 Response: 24 hours</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild className="flex-1">
            <a href="/">Continue Shopping</a>
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <a href="/track-order">Track Order</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
