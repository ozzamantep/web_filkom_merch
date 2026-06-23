import { useState, useEffect } from "react";
import { Search, Plus, Minus, Trash2, DollarSign, Printer, X, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@frontend/components/ui/button";
import { Input } from "@frontend/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select";
import type { CreateSaleInput, PaymentMethod } from "@backend/server-actions";
import { createSale, getPaymentMethods } from "@backend/server-actions";
import { bluetoothPrinter, type ReceiptData } from "@frontend/lib/bluetooth-printer";
import type { ProductWithVariants } from "@backend/server-actions";
import { getProducts } from "@backend/server-actions";

interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

interface CartItem extends SaleItem {
  id: string;
}

interface POSKasirProps {
  admin_id: number;
  admin_name: string;
  store_name: string;
}

export function POSKasir({ admin_id, admin_name, store_name }: POSKasirProps) {
  // State
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithVariants[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load products & payment methods
  useEffect(() => {
    const loadData = async () => {
      try {
        const productsResult = (await getProducts()) as unknown as { products: ProductWithVariants[] };
        if (productsResult?.products) {
          setProducts(productsResult.products);
          setFilteredProducts(productsResult.products);
        }

        const methodsResult = (await getPaymentMethods()) as unknown as { methods: PaymentMethod[] };
        if (methodsResult?.methods && methodsResult.methods.length > 0) {
          setPaymentMethods(methodsResult.methods);
          setSelectedPaymentMethod(methodsResult.methods[0].id.toString());
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter products by search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = products.filter(
        (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               p.slug.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.1); // 10% tax
  const total = subtotal - discount + tax;

  // Add to cart
  const addToCart = (product: ProductWithVariants) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    
    if (existingItem) {
      updateQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      const cartItem: CartItem = {
        id: `cart-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        discount: 0,
      };
      setCart([...cart, cartItem]);
    }
  };

  // Update quantity
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(cart.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)));
  };

  // Remove from cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  // Clear cart
  const clearCart = () => {
    if (window.confirm("Yakin ingin mengosongkan keranjang?")) {
      setCart([]);
      setCustomerName("");
      setDiscount(0);
    }
  };

  // Process payment
  const handlePayment = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong!");
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error("Pilih metode pembayaran!");
      return;
    }

    setIsProcessing(true);

    try {
      const saleInput: CreateSaleInput = {
        admin_id,
        payment_method_id: parseInt(selectedPaymentMethod),
        items: cart,
        subtotal,
        discount,
        tax,
        total,
      };

      const result = (await createSale({ data: saleInput })) as any;

      if (!result.success) {
        throw new Error(result.error);
      }

      // Get payment method name
      const paymentMethod = paymentMethods.find((m) => m.id.toString() === selectedPaymentMethod);

      // Print receipt
      if (printerConnected) {
        const receiptData: ReceiptData = {
          store_name,
          sale_id: result.sale_id,
          date: new Date().toLocaleDateString("id-ID"),
          time: new Date().toLocaleTimeString("id-ID"),
          items: cart.map((item) => ({
            name: item.product_name,
            qty: item.quantity,
            price: item.unit_price,
            subtotal: item.unit_price * item.quantity,
          })),
          subtotal,
          discount,
          tax,
          total,
          payment_method: paymentMethod?.name || "Unknown",
          cashier_name: admin_name,
          customer_name: customerName || undefined,
        };

        try {
          await bluetoothPrinter.printReceipt(receiptData);
        } catch (printError) {
          console.error("Print error:", printError);
          toast.warning("Transaksi berhasil, tapi print gagal");
        }
      }

      // Success
      toast.success(`Transaksi berhasil! Sale ID: ${result.sale_id}`);
      
      // Reset
      setCart([]);
      setCustomerName("");
      setDiscount(0);
      setSearchQuery("");
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Transaksi gagal");
    } finally {
      setIsProcessing(false);
    }
  };

  // Connect printer
  const handleConnectPrinter = async () => {
    try {
      const devices = await bluetoothPrinter.scanDevices();
      if (devices.length === 0) {
        toast.error("Tidak ada printer ditemukan");
        return;
      }

      await bluetoothPrinter.connect(devices[0].id);
      setPrinterConnected(true);
      toast.success("Printer terhubung!");
    } catch (error) {
      console.error("Printer connection error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal terhubung ke printer");
    }
  };

  // Test printer
  const handleTestPrinter = async () => {
    try {
      if (!printerConnected) {
        toast.error("Printer belum terhubung");
        return;
      }
      await bluetoothPrinter.testPrint();
      toast.success("Test print berhasil!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test print gagal");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 bg-background min-h-screen">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Produk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[600px] overflow-y-auto">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-3 border border-border rounded-lg hover:bg-accent hover:border-primary transition text-left"
                >
                  <div className="text-xs font-semibold text-foreground truncate">{product.name}</div>
                  <div className="text-sm font-bold text-primary mt-1">
                    Rp {product.price.toLocaleString("id-ID")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Click to add</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cart Section */}
      <div className="space-y-4">
        {/* Cart Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Keranjang
              </CardTitle>
              <button
                onClick={clearCart}
                className="text-destructive hover:text-destructive/80"
                title="Clear cart"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Cart Items */}
            <div className="max-h-[300px] overflow-y-auto space-y-2 border-b pb-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Keranjang kosong</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="text-sm bg-accent p-2 rounded">
                    <div className="font-semibold truncate">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Rp {item.unit_price.toLocaleString("id-ID")}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-background rounded"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="w-10 text-center text-xs border rounded"
                      />
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-background rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-auto p-1 text-destructive hover:bg-background rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-sm text-yellow-600">
                  <span>Diskon:</span>
                  <span>-Rp {discount.toLocaleString("id-ID")}</span>
                </div>
              )}

              {tax > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Pajak (10%):</span>
                  <span>Rp {tax.toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className="border-t pt-2 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>Rp {total.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* Customer & Discount */}
            <div className="space-y-2 border-t pt-3">
              <Input
                placeholder="Nama customer (opsional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs"
              />

              <Input
                type="number"
                placeholder="Diskon (Rp)"
                value={discount || ""}
                onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                className="text-xs"
              />

              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id.toString()}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Printer Section */}
            <div className="border-t pt-3 space-y-2">
              <Button
                onClick={handleConnectPrinter}
                variant={printerConnected ? "default" : "outline"}
                size="sm"
                className="w-full text-xs"
              >
                <Printer className="h-3 w-3 mr-2" />
                {printerConnected ? "✔ Printer Connected" : "Connect Printer"}
              </Button>

              {printerConnected && (
                <Button onClick={handleTestPrinter} variant="outline" size="sm" className="w-full text-xs">
                  Test Print
                </Button>
              )}
            </div>

            {/* Checkout Button */}
            <Button
              onClick={handlePayment}
              disabled={cart.length === 0 || isProcessing}
              size="lg"
              className="w-full"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Checkout"}
            </Button>
          </CardContent>
        </Card>

        {/* Cashier Info */}
        <Card className="text-xs text-muted-foreground p-3">
          <div>👤 Kasir: {admin_name}</div>
          <div>🏪 {store_name}</div>
        </Card>
      </div>
    </div>
  );
}
