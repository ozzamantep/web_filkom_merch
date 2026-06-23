import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, Package, TrendingUp, Users, LogOut, Settings, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { getDailySalesSummary, getTopProducts, getInventory } from "@/routes/api/-admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Admin Panel" },
      { name: "description", content: "Sales analytics and management" },
    ],
  }),
});

interface DailySummary {
  total_transactions: number;
  total_revenue: number;
  total_discount: number;
  avg_transaction: number;
}

interface TopProduct {
  id: number;
  name: string;
  total_quantity_sold: number;
  total_revenue: number;
}

interface InventoryItem {
  id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  stock: number;
  min_stock: number;
  status: "ok" | "low" | "out";
}

function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if admin - wait for auth to load first
  useEffect(() => {
    if (!authLoading && (!user || user.type !== "admin")) {
      navigate({ to: "/login" });
    }
  }, [user, navigate, authLoading]);

  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        // Load today's summary
        try {
          const summaryResult = await getDailySalesSummary(today);
          console.log("Summary result:", summaryResult);
          if (summaryResult && 'summary' in summaryResult) {
            setSummary((summaryResult as any).summary);
          }
        } catch (err) {
          console.error("Summary error:", err);
        }

        // Load top products
        try {
          const productsResult = await getTopProducts(10, 30);
          console.log("Products result:", productsResult);
          if (productsResult && 'products' in productsResult) {
            setTopProducts((productsResult as any).products);
          }
        } catch (err) {
          console.error("Products error:", err);
        }

        // Load inventory
        try {
          const inventoryResult = await getInventory();
          console.log("Inventory result:", inventoryResult);
          if (inventoryResult && 'inventory' in inventoryResult) {
            setInventory((inventoryResult as any).inventory);
          }
        } catch (err) {
          console.error("Inventory error:", err);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        toast.error("Gagal memuat data dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (authLoading || loading || !user || user.type !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading...</h2>
          <p className="text-muted-foreground">Please wait while we load your dashboard.</p>
        </div>
      </div>
    );
  }

  const admin = user as any;

  // Prepare chart data
  const inventoryChartData = inventory.map((item) => ({
    name: item.product_name,
    stock: item.stock,
    minStock: item.min_stock,
  }));

  const lowStockItems = inventory.filter((item) => item.status === "low" || item.status === "out");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Sales Analytics & Management</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold">{admin.username || admin.email}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigate({ to: "/admin/kasir" })}>
              <BarChart3 className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                logout();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {(summary?.total_revenue || 0).toLocaleString("id-ID")}</div>
              <p className="text-xs text-muted-foreground mt-1">dari {summary?.total_transactions || 0} transaksi</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.total_transactions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Rp {(summary?.avg_transaction || 0).toLocaleString("id-ID")} rata-rata</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Diskon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">-Rp {(summary?.total_discount || 0).toLocaleString("id-ID")}</div>
              <p className="text-xs text-muted-foreground mt-1">{summary?.total_transactions ? ((summary.total_discount / summary.total_revenue) * 100).toFixed(1) : 0}% dari revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">produk perlu restock</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sales">📊 Penjualan</TabsTrigger>
            <TabsTrigger value="products">🏆 Top Produk</TabsTrigger>
            <TabsTrigger value="inventory">📦 Inventory</TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend (30 hari)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Grafik tren revenue untuk 30 hari terakhir
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[]} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Produk Terjual (30 hari)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Belum ada penjualan</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topProducts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total_quantity_sold" fill="#8884d8" name="Qty Terjual" />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Products Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left">Produk</th>
                            <th className="p-3 text-right">Qty</th>
                            <th className="p-3 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((product) => (
                            <tr key={product.id} className="border-t border-border hover:bg-muted/50">
                              <td className="p-3">{product.name}</td>
                              <td className="p-3 text-right">{product.total_quantity_sold}</td>
                              <td className="p-3 text-right font-semibold">
                                Rp {product.total_revenue.toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Manajemen Stok</h3>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Stok
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Normal</p>
                    <p className="text-2xl font-bold text-green-600">
                      {inventory.filter((i) => i.status === "ok").length}
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {inventory.filter((i) => i.status === "low").length}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-600">
                      {inventory.filter((i) => i.status === "out").length}
                    </p>
                  </div>
                </div>

                {/* Inventory Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left">Produk</th>
                        <th className="p-3 text-right">Stock</th>
                        <th className="p-3 text-right">Min Stock</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-t border-border ${item.status === "out" ? "bg-red-50" : item.status === "low" ? "bg-yellow-50" : "hover:bg-muted/50"}`}
                        >
                          <td className="p-3 font-medium">{item.product_name}</td>
                          <td className="p-3 text-right font-semibold">{item.stock}</td>
                          <td className="p-3 text-right">{item.min_stock}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                item.status === "ok"
                                  ? "bg-green-100 text-green-700"
                                  : item.status === "low"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {item.status === "ok" ? "✓ OK" : item.status === "low" ? "⚠ Low" : "✗ Out"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button className="text-primary hover:underline text-xs font-semibold">
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
