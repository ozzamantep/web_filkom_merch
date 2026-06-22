import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft, Loader2, QrCode, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createOrderAndPayment } from "@backend/server-actions";
import { Button } from "@frontend/components/ui/button";
import { Input } from "@frontend/components/ui/input";
import { Label } from "@frontend/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";
import type { CartItem } from "@backend/services/midtrans";
import { MIDTRANS_CONFIG } from "@backend/services/midtrans";

interface CheckoutStep {
  step: number;
  title: string;
}

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout — Filkom Merch UB" },
      { name: "description", content: "Checkout and complete your Filkom Merch purchase" },
    ],
  }),
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState(user?.type === "buyer" ? user.name : "");
  const [customerEmail, setCustomerEmail] = useState(user?.type === "buyer" ? user.email : "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNim, setCustomerNim] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);

  const steps: CheckoutStep[] = [
    { step: 1, title: "Review Cart" },
    { step: 2, title: "Customer Details" },
    { step: 3, title: "Payment" },
    { step: 4, title: "QR Code" },
  ];

  // Check auth and load cart
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    // Load cart from localStorage
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch {
        toast.error("Failed to load cart");
      }
    } else {
      toast.error("Your cart is empty");
    }
  }, [user, navigate]);

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCartItems(cartItems.filter((item) => item.id !== itemId));
    } else {
      setCartItems(
        cartItems.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)),
      );
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
  };

  const validateStep = (): boolean => {
    if (currentStep === 2) {
      if (!customerName.trim()) {
        toast.error("Please enter your name");
        return false;
      }
      if (!customerEmail.trim()) {
        toast.error("Please enter your email");
        return false;
      }
      if (!customerPhone.trim()) {
        toast.error("Please enter your phone number");
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        toast.error("Please enter a valid email");
        return false;
      }
    }
    if (currentStep === 1 && cartItems.length === 0) {
      toast.error("Your cart is empty");
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validateStep()) return;

    setIsProcessing(true);
    const newOrderId = `FILKOM-${Date.now()}`;
    setOrderId(newOrderId);

    try {
      const buyerUserId =
        user?.type === "buyer" && Number.isFinite(Number(user.id)) ? Number(user.id) : undefined;

      const transactionDetails = {
        orderId: newOrderId,
        grossAmount: totalAmount,
        customerName,
        customerNim: customerNim.trim() || undefined,
        customerEmail,
        customerPhone,
        shippingAddress: shippingAddress.trim() || undefined,
        items: cartItems,
        userId: buyerUserId,
      };

      // Call server function untuk create order di database dan generate QRIS
      const result = await createOrderAndPayment({ data: transactionDetails });

      if (!result.success || !result.token) {
        throw new Error(result.error || "Failed to create payment");
      }

      // Set QR code URL
      setQrUrl(result.qrUrl);

      // Move to QR code step
      setCurrentStep(4);

      // Clear cart dari localStorage
      localStorage.removeItem("cart");

      toast.success("QRIS berhasil dibuat! Silakan scan untuk membayar.");
      setIsProcessing(false);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Payment failed");
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0 && !isProcessing) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          </div>
        </div>

        {/* Empty Cart */}
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Your cart is empty</h2>
            <p className="mb-6 text-muted-foreground">Add some items to get started</p>
            <Button asChild>
              <a href="/">Continue Shopping</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <a href="/">
                <ArrowLeft className="h-5 w-5" />
              </a>
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.step} className="flex items-center flex-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    currentStep >= s.step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.step}
                </div>
                <div className="ml-3 hidden text-sm font-medium sm:block">{s.title}</div>
                {index < steps.length - 1 && (
                  <div
                    className={`ml-4 h-1 flex-1 ${currentStep > s.step ? "bg-primary" : "bg-muted"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Section */}
          <div className="lg:col-span-2">
            {currentStep === 1 && (
              <CartReviewStep
                items={cartItems}
                onQuantityChange={handleQuantityChange}
                onRemoveItem={handleRemoveItem}
              />
            )}
            {currentStep === 2 && (
              <CustomerDetailsStep
                name={customerName}
                email={customerEmail}
                phone={customerPhone}
                nim={customerNim}
                address={shippingAddress}
                onNameChange={setCustomerName}
                onEmailChange={setCustomerEmail}
                onPhoneChange={setCustomerPhone}
                onNimChange={setCustomerNim}
                onAddressChange={setShippingAddress}
              />
            )}
            {currentStep === 3 && (
              <PaymentReviewStep
                items={cartItems}
                customer={{
                  name: customerName,
                  nim: customerNim,
                  email: customerEmail,
                  phone: customerPhone,
                  address: shippingAddress,
                }}
              />
            )}
            {currentStep === 4 && qrUrl && (
              <QrCodePaymentStep qrUrl={qrUrl} orderId={orderId} customerName={customerName} />
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex gap-4">
              {currentStep > 1 && currentStep < 4 && (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                  Back
                </Button>
              )}
              {currentStep < 3 && (
                <Button
                  onClick={() => {
                    if (validateStep()) {
                      setCurrentStep(currentStep + 1);
                    }
                  }}
                >
                  Next
                </Button>
              )}
              {currentStep === 3 && (
                <Button onClick={handlePayment} disabled={isProcessing} className="flex-1">
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Generate QR Code
                    </>
                  )}
                </Button>
              )}
              {currentStep === 4 && (
                <Button asChild className="flex-1">
                  <a href="/">Done</a>
                </Button>
              )}
            </div>
          </div>

          {/* Right Section - Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg text-primary">
                      Rp {totalAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {currentStep === 3 && (
                  <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                    <p className="font-semibold">ℹ️ Sandbox Payment</p>
                    <p className="mt-1">Klik "Generate QR Code" untuk membuat QRIS</p>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="rounded-lg bg-green-50 p-3 text-xs text-green-900">
                    <p className="font-semibold">✓ QR Code Ready</p>
                    <p className="mt-1">Scan dengan aplikasi pembayaran pilihan Anda</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CartReviewStepProps {
  items: CartItem[];
  onQuantityChange: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

function CartReviewStep({ items, onQuantityChange, onRemoveItem }: CartReviewStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Your Items</CardTitle>
        <CardDescription>Check your cart before proceeding</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex-1">
                <h3 className="font-medium text-foreground">{item.name}</h3>
                <p className="text-sm text-muted-foreground">{item.category}</p>
                <p className="mt-1 font-semibold text-foreground">
                  Rp {item.price.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                  >
                    +
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemoveItem(item.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomerDetailsStepProps {
  name: string;
  nim: string;
  email: string;
  phone: string;
  address: string;
  onNameChange: (value: string) => void;
  onNimChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

function CustomerDetailsStep({
  name,
  nim,
  email,
  phone,
  address,
  onNameChange,
  onNimChange,
  onEmailChange,
  onPhoneChange,
  onAddressChange,
}: CustomerDetailsStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Details</CardTitle>
        <CardDescription>Enter your information for delivery and payment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nim">NIM</Label>
          <Input
            id="nim"
            placeholder="23515040000000"
            value={nim}
            onChange={(e) => onNimChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+62 812 3456 7890"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Shipping Address</Label>
          <Input
            id="address"
            placeholder="Alamat pengiriman"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface PaymentReviewStepProps {
  items: CartItem[];
  customer: {
    name: string;
    nim: string;
    email: string;
    phone: string;
    address: string;
  };
}

function PaymentReviewStep({ items, customer }: PaymentReviewStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-muted-foreground">
                {item.name} × {item.quantity}
              </span>
              <span className="font-medium">
                Rp {(item.price * item.quantity).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery To</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-medium">{customer.name}</p>
          {customer.nim && <p className="text-sm text-muted-foreground">NIM: {customer.nim}</p>}
          <p className="text-sm text-muted-foreground">{customer.email}</p>
          <p className="text-sm text-muted-foreground">{customer.phone}</p>
          {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

interface QrCodePaymentStepProps {
  qrUrl: string;
  orderId: string | null;
  customerName: string;
}

function QrCodePaymentStep({ qrUrl, orderId, customerName }: QrCodePaymentStepProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(orderId || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan QR Code untuk Membayar</CardTitle>
          <CardDescription>
            Gunakan aplikasi pembayaran apapun (GoPay, Dana, OVO, dll)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {/* QR Code */}
          <div className="rounded-lg border-4 border-primary p-6 bg-white">
            <img src={qrUrl} alt="QRIS Payment" className="w-64 h-64 object-contain" />
          </div>

          {/* Order ID */}
          <div className="w-full">
            <label className="text-sm font-semibold text-foreground mb-2 block">Order ID</label>
            <div className="flex gap-2">
              <Input value={orderId || ""} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="w-full space-y-3 rounded-lg bg-blue-50 p-4">
            <p className="font-semibold text-blue-900">Cara Membayar:</p>
            <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
              <li>Buka aplikasi pembayaran Anda (GoPay, Dana, OVO, LinkAja, dsb)</li>
              <li>Pilih menu "Scan QR Code"</li>
              <li>Arahkan kamera ke QR code di atas</li>
              <li>Verifikasi jumlah pembayaran</li>
              <li>Masukkan PIN/password Anda</li>
              <li>Pembayaran berhasil! Anda akan mendapat notifikasi</li>
            </ol>
          </div>

          {/* Payment Methods */}
          <div className="w-full">
            <p className="text-xs font-semibold text-muted-foreground mb-3">
              Metode Pembayaran yang Diterima:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {["GoPay", "OVO", "Dana", "LinkAja", "AlfaBank", "Jago"].map((method) => (
                <div
                  key={method}
                  className="rounded border border-border p-2 text-center text-xs font-medium text-foreground"
                >
                  {method}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
            <p className="text-sm">Menunggu pembayaran dari {customerName}...</p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Halaman ini akan otomatis diperbarui saat pembayaran diterima
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Global type for Midtrans Snap
declare global {
  type MidtransSnapResult = {
    transaction_id?: string;
    order_id?: string;
    transaction_status?: string;
    [key: string]: unknown;
  };

  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: MidtransSnapResult) => void;
          onPending?: (result: MidtransSnapResult) => void;
          onError?: (result: MidtransSnapResult) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}
