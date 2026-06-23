import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  X,
  ShoppingCart,
  Banknote,
  QrCode,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@frontend/components/ui/button";
import { Input } from "@frontend/components/ui/input";
import { Badge } from "@frontend/components/ui/badge";
import { ScrollArea } from "@frontend/components/ui/scroll-area";
import type { CreateSaleInput } from "@backend/server-actions";
import { createSale, getProducts, getCategories } from "@backend/server-actions";
import { bluetoothPrinter, type ReceiptData } from "@frontend/lib/bluetooth-printer";
import type { ProductWithVariants, Category } from "@backend/server-actions";

interface CartItem {
  id: string;
  product_id: number;
  product_name: string;
  variant_id?: number;
  size?: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

type PaymentMethod = "cash" | "qris" | "debit";

interface POSKasirProps {
  admin_id: number;
  admin_name: string;
  store_name: string;
}

export function POSKasir({ admin_id, admin_name, store_name }: POSKasirProps) {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [productsResult, categoriesResult] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      if (productsResult?.products) setProducts(productsResult.products);
      if (categoriesResult?.categories) setCategories(categoriesResult.categories);
    } catch {
      toast.error("Gagal memuat data produk");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getTotalStock = (product: ProductWithVariants) =>
    product.variants.reduce((sum, v) => sum + v.stock, 0);

  const filteredProducts = products.filter((p) => {
    const matchCategory =
      categoryFilter === "all" || String(p.category_id) === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      String(p.id).includes(q) ||
      p.variants.some((v) => v.size.toLowerCase().includes(q));
    return matchCategory && matchSearch && getTotalStock(p) > 0;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const total = subtotal - discount;

  const addToCart = (product: ProductWithVariants) => {
    const variant = product.variants.find((v) => v.stock > 0) || product.variants[0];
    if (!variant || variant.stock <= 0) {
      toast.error("Stok habis");
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.id && item.variant_id === variant.id,
    );

    if (existing) {
      if (existing.quantity >= variant.stock) {
        toast.error("Stok tidak cukup");
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          id: `cart-${Date.now()}`,
          product_id: product.id,
          product_name: `${product.name}${variant.size !== "One Size" ? ` (${variant.size})` : ""}`,
          variant_id: variant.id,
          size: variant.size,
          quantity: 1,
          unit_price: product.price,
          discount: 0,
        },
      ]);
    }
  };

  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter((item) => item.id !== itemId));
      return;
    }
    const item = cart.find((i) => i.id === itemId);
    if (item) {
      const product = products.find((p) => p.id === item.product_id);
      const variant = product?.variants.find((v) => v.id === item.variant_id);
      if (variant && newQty > variant.stock) {
        toast.error("Stok tidak cukup");
        return;
      }
    }
    setCart(cart.map((item) => (item.id === itemId ? { ...item, quantity: newQty } : item)));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Kosongkan keranjang?")) {
      setCart([]);
      setCustomerName("");
      setDiscount(0);
      setNotes("");
    }
  };

  const handlePayment = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong!");
      return;
    }

    setIsProcessing(true);
    try {
      const saleInput: CreateSaleInput = {
        admin_id,
        cashier_name: admin_name,
        payment_method: paymentMethod,
        items: cart,
        subtotal,
        discount,
        tax: 0,
        total,
        notes: notes || undefined,
        customer_name: customerName || undefined,
      };

      const result = await createSale({ data: saleInput });

      if (!result.success) {
        throw new Error(result.error);
      }

      const paymentLabels: Record<PaymentMethod, string> = {
        cash: "Tunai",
        qris: "QRIS Statis",
        debit: "Debit",
      };

      if (printerConnected) {
        const receiptData: ReceiptData = {
          store_name,
          sale_id: result.sale_id!,
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
          tax: 0,
          total,
          payment_method: paymentLabels[paymentMethod],
          cashier_name: admin_name,
          customer_name: customerName || undefined,
        };
        try {
          await bluetoothPrinter.printReceipt(receiptData);
        } catch {
          toast.warning("Transaksi berhasil, cetak struk gagal");
        }
      }

      toast.success(`Transaksi berhasil! ${result.sale_id}`);
      setCart([]);
      setCustomerName("");
      setDiscount(0);
      setNotes("");
      setSearchQuery("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaksi gagal");
    } finally {
      setIsProcessing(false);
    }
  };

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
      toast.error(error instanceof Error ? error.message : "Gagal hubungkan printer");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        Memuat produk...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Products 70% */}
      <div className="flex w-[70%] flex-col border-r border-zinc-800">
        <div className="shrink-0 space-y-3 border-b border-zinc-800 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Cari produk / barcode / slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-zinc-700 bg-zinc-900 pl-10 text-white placeholder:text-zinc-500"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                categoryFilter === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(String(cat.id))}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  categoryFilter === String(cat.id)
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => {
              const stock = getTotalStock(product);
              const sizes = product.variants.filter((v) => v.stock > 0).map((v) => v.size);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-900/20 active:scale-[0.98]"
                >
                  <div className="aspect-square overflow-hidden bg-zinc-800">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-600 text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">
                      {product.name}
                    </p>
                    {sizes.length > 0 && (
                      <p className="mt-1 text-[10px] text-zinc-500 truncate">
                        {sizes.join(", ")}
                      </p>
                    )}
                    <p className="mt-auto pt-1 text-sm font-bold text-emerald-400">
                      Rp {Number(product.price).toLocaleString("id-ID")}
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-1 w-fit text-[10px] ${
                        stock <= 5
                          ? "border-yellow-600 text-yellow-500"
                          : "border-zinc-600 text-zinc-400"
                      }`}
                    >
                      Stok: {stock}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <p className="py-12 text-center text-zinc-500">Produk tidak ditemukan</p>
          )}
        </ScrollArea>
      </div>

      {/* Right: Cart 30% */}
      <div className="flex w-[30%] flex-col bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-white">
            <ShoppingCart className="h-5 w-5 text-emerald-400" />
            Keranjang
            {cart.length > 0 && (
              <Badge className="bg-emerald-600">{cart.length}</Badge>
            )}
          </div>
          <button onClick={clearCart} className="text-zinc-500 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-4">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Keranjang kosong</p>
          ) : (
            <div className="space-y-2 py-2">
              {cart.map((item) => (
                <div key={item.id} className="rounded-lg bg-zinc-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white leading-tight">
                      {item.product_name}
                    </p>
                    <button
                      onClick={() => setCart(cart.filter((c) => c.id !== item.id))}
                      className="shrink-0 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Rp {item.unit_price.toLocaleString("id-ID")}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="rounded bg-zinc-700 p-1 hover:bg-zinc-600"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="rounded bg-zinc-700 p-1 hover:bg-zinc-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="ml-auto text-sm font-semibold text-emerald-400">
                      Rp {(item.unit_price * item.quantity).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="shrink-0 space-y-3 border-t border-zinc-800 p-4">
          <Input
            placeholder="Nama pelanggan (opsional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="border-zinc-700 bg-zinc-800 text-sm text-white"
          />
          <Input
            type="number"
            placeholder="Diskon (Rp)"
            value={discount || ""}
            onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
            className="border-zinc-700 bg-zinc-800 text-sm text-white"
          />
          <Input
            placeholder="Catatan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border-zinc-700 bg-zinc-800 text-sm text-white"
          />

          <div className="space-y-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Metode Pembayaran</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "cash" as const, label: "TUNAI", icon: Banknote },
                  { key: "qris" as const, label: "QRIS", icon: QrCode },
                  { key: "debit" as const, label: "DEBIT", icon: CreditCard },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-bold transition ${
                    paymentMethod === key
                      ? key === "cash"
                        ? "bg-green-600 text-white ring-2 ring-green-400"
                        : key === "qris"
                          ? "bg-blue-600 text-white ring-2 ring-blue-400"
                          : "bg-purple-600 text-white ring-2 ring-purple-400"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 rounded-lg bg-zinc-800 p-3">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString("id-ID")}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-yellow-500">
                <span>Diskon</span>
                <span>-Rp {discount.toLocaleString("id-ID")}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-white pt-1 border-t border-zinc-700">
              <span>TOTAL</span>
              <span className="text-emerald-400">Rp {total.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <button
            onClick={() => void handleConnectPrinter()}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs transition ${
              printerConnected
                ? "bg-zinc-700 text-emerald-400"
                : "border border-zinc-600 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <Printer className="h-3.5 w-3.5" />
            {printerConnected ? "Printer Terhubung" : "Hubungkan Printer Bluetooth"}
          </button>

          <Button
            onClick={() => void handlePayment()}
            disabled={cart.length === 0 || isProcessing}
            className="h-14 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-500 disabled:opacity-50"
            size="lg"
          >
            {isProcessing ? "Memproses..." : "BAYAR & CETAK STRUK"}
          </Button>
        </div>
      </div>
    </div>
  );
}
