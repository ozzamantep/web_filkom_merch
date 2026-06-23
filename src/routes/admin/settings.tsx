import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Input } from "@frontend/components/ui/input";
import { Label } from "@frontend/components/ui/label";
import { Textarea } from "@frontend/components/ui/textarea";
import { getStoreSettings, updateStoreSettings, type StoreSettings } from "@backend/server-actions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
  head: () => ({ meta: [{ title: "Pengaturan — Admin Panel" }] }),
});

function AdminSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getStoreSettings()
      .then((res) => setSettings(res.settings))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const result = await updateStoreSettings({
      data: {
        store_name: settings.store_name,
        address: settings.address || undefined,
        phone: settings.phone || undefined,
        tax_rate: settings.tax_rate,
        qris_static_url: settings.qris_static_url || undefined,
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success("Pengaturan toko disimpan");
    } else {
      toast.error(result.error || "Gagal menyimpan");
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-muted-foreground">Memuat pengaturan...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan Toko</h1>
        <p className="text-sm text-muted-foreground">Konfigurasi informasi toko dan POS</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Toko</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Toko</Label>
            <Input
              value={settings.store_name}
              onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Alamat</Label>
            <Textarea
              value={settings.address || ""}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Telepon</Label>
            <Input
              value={settings.phone || ""}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Pajak (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={settings.tax_rate}
              onChange={(e) =>
                setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>URL QRIS Statis</Label>
            <Input
              placeholder="https://..."
              value={settings.qris_static_url || ""}
              onChange={(e) => setSettings({ ...settings, qris_static_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Digunakan saat kasir memilih pembayaran QRIS Statis di POS
            </p>
          </div>

          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
