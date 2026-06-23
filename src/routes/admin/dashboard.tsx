import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/components/ui/tabs";
import {
  getDailySalesSummary,
  getTopProducts,
  getInventory,
  type DailySummary,
  type TopProduct,
  type InventoryItem,
} from "@backend/server-actions";
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

function AdminDashboardPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [summaryResult, productsResult, inventoryResult] = await Promise.all([
          getDailySalesSummary({ data: today }),
          getTopProducts({ data: { limit: 10, days: 30 } }),
          getInventory(),
        ]);

        if (summaryResult && "summary" in summaryResult && summaryResult.summary) {
          setSummary(summaryResult.summary);
        }
        if (productsResult && "products" in productsResult && productsResult.products) {
          setTopProducts(productsResult.products);
        }
        if (inventoryResult && "inventory" in inventoryResult && inventoryResult.inventory) {
          setInventory(inventoryResult.inventory);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        toast.error("Gagal memuat data dashboard");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Memuat dashboard...</p>
      </div>
    );
  }

  const lowStockItems = inventory.filter((item) => item.status === "low" || item.status === "out");

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan penjualan offline hari ini</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue (Hari Ini)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {(summary?.total_revenue || 0).toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              dari {summary?.total_transactions || 0} transaksi POS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_transactions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Rp {(summary?.avg_transaction || 0).toLocaleString("id-ID")} rata-rata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Diskon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              -Rp {(summary?.total_discount || 0).toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stok Rendah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">varian perlu restock</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Top Produk</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Produk Terjual (30 hari)</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Belum ada penjualan offline
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-30} textAnchor="end" height={80} fontSize={11} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_quantity_sold" fill="hsl(var(--primary))" name="Qty" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="border rounded-lg overflow-hidden mt-4">
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
                          <tr key={product.id} className="border-t border-border">
                            <td className="p-3">{product.name}</td>
                            <td className="p-3 text-right">{product.total_quantity_sold}</td>
                            <td className="p-3 text-right font-semibold">
                              Rp {Number(product.total_revenue).toLocaleString("id-ID")}
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

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Status Stok Produk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Produk</th>
                      <th className="p-3 text-right">Stok</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="p-3">{item.product_name}</td>
                        <td className="p-3 text-right font-semibold">{item.stock}</td>
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
                            {item.status === "ok" ? "OK" : item.status === "low" ? "Rendah" : "Habis"}
                          </span>
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
  );
}
