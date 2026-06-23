import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/components/ui/tabs";
import { Badge } from "@frontend/components/ui/badge";
import { getOnlineOrders, getOfflineSales, type Order, type OfflineSale } from "@backend/server-actions";

export const Route = createFileRoute("/admin/transactions")({
  component: AdminTransactionsPage,
  head: () => ({ meta: [{ title: "Transaksi — Admin Panel" }] }),
});

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  settlement: "bg-green-100 text-green-800",
  capture: "bg-green-100 text-green-800",
  expire: "bg-red-100 text-red-800",
  cancel: "bg-gray-100 text-gray-600",
  completed: "bg-green-100 text-green-800",
};

function AdminTransactionsPage() {
  const [onlineOrders, setOnlineOrders] = useState<Order[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([getOnlineOrders(), getOfflineSales()])
      .then(([online, offline]) => {
        setOnlineOrders(online.orders);
        setOfflineSales(offline.sales);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Memuat transaksi...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manajemen Transaksi</h1>
        <p className="text-sm text-muted-foreground">
          Pesanan online (Midtrans) dan penjualan offline (POS)
        </p>
      </div>

      <Tabs defaultValue="online">
        <TabsList>
          <TabsTrigger value="online">Pesanan Online</TabsTrigger>
          <TabsTrigger value="offline">Penjualan Offline / POS</TabsTrigger>
        </TabsList>

        <TabsContent value="online">
          <Card>
            <CardHeader>
              <CardTitle>Pesanan Online</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Order ID</th>
                      <th className="p-3 text-left">Pelanggan</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-left">Pembayaran</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-left">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Belum ada pesanan online
                        </td>
                      </tr>
                    ) : (
                      onlineOrders.map((order) => (
                        <tr key={order.id} className="border-t border-border">
                          <td className="p-3 font-mono text-xs">{order.order_id}</td>
                          <td className="p-3">
                            <p className="font-medium">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                          </td>
                          <td className="p-3 text-right font-semibold">
                            Rp {Number(order.gross_amount).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3">{order.payment_type || "-"}</td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                statusColor[order.transaction_status] ||
                                "bg-muted text-muted-foreground"
                              }
                            >
                              {order.transaction_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offline">
          <Card>
            <CardHeader>
              <CardTitle>Penjualan Offline / POS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Sale ID</th>
                      <th className="p-3 text-left">Kasir</th>
                      <th className="p-3 text-left">Pelanggan</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-left">Pembayaran</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-left">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offlineSales.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          Belum ada penjualan offline
                        </td>
                      </tr>
                    ) : (
                      offlineSales.map((sale) => (
                        <tr key={sale.id} className="border-t border-border">
                          <td className="p-3 font-mono text-xs">{sale.sale_id}</td>
                          <td className="p-3">{sale.cashier_name || "-"}</td>
                          <td className="p-3">{sale.customer_name || "Walk-in"}</td>
                          <td className="p-3 text-right font-semibold">
                            Rp {Number(sale.total).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3">{sale.payment_method}</td>
                          <td className="p-3 text-center">
                            <Badge className={statusColor[sale.status] || statusColor.completed}>
                              {sale.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(sale.created_at).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))
                    )}
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
