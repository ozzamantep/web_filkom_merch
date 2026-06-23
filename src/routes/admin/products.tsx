import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Input } from "@frontend/components/ui/input";
import { Label } from "@frontend/components/ui/label";
import { Textarea } from "@frontend/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select";
import {
  getAllProductsAdmin,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductWithVariants,
  type Category,
} from "@backend/server-actions";

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
  head: () => ({ meta: [{ title: "Produk — Admin Panel" }] }),
});

interface ProductForm {
  id?: number;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  image_url: string;
  variants: Array<{ size: string; stock: string }>;
}

const emptyForm = (): ProductForm => ({
  category_id: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  image_url: "",
  variants: [{ size: "One Size", stock: "0" }],
});

function AdminProductsPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    const [productsRes, categoriesRes] = await Promise.all([
      getAllProductsAdmin(),
      getCategories(),
    ]);
    setProducts(productsRes.products);
    setCategories(categoriesRes.categories);
  };

  useEffect(() => {
    void loadProducts().finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (product: ProductWithVariants) => {
    setForm({
      id: product.id,
      category_id: String(product.category_id),
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      price: String(product.price),
      image_url: product.image_url || "",
      variants: product.variants.map((v) => ({
        size: v.size,
        stock: String(v.stock),
      })),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category_id || !form.name || !form.slug || !form.price) {
      toast.error("Lengkapi data produk");
      return;
    }

    setSaving(true);
    const payload = {
      category_id: parseInt(form.category_id),
      name: form.name,
      slug: form.slug,
      description: form.description,
      price: parseFloat(form.price),
      image_url: form.image_url || undefined,
      variants: form.variants.map((v) => ({
        size: v.size,
        stock: parseInt(v.stock) || 0,
      })),
    };

    const result = form.id
      ? await updateProduct({ data: { ...payload, id: form.id } })
      : await createProduct({ data: payload });

    setSaving(false);

    if (result.success) {
      toast.success(form.id ? "Produk diperbarui" : "Produk ditambahkan");
      setDialogOpen(false);
      await loadProducts();
    } else {
      toast.error(result.error || "Gagal menyimpan produk");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Nonaktifkan produk ini?")) return;
    const result = await deleteProduct({ data: id });
    if (result.success) {
      toast.success("Produk dinonaktifkan");
      await loadProducts();
    } else {
      toast.error(result.error || "Gagal menghapus produk");
    }
  };

  const totalStock = (p: ProductWithVariants) =>
    p.variants.reduce((sum, v) => sum + v.stock, 0);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Memuat produk...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Produk</h1>
          <p className="text-sm text-muted-foreground">CRUD produk — stok tersinkron dengan POS</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Produk
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Produk</th>
                  <th className="p-3 text-left">Kategori</th>
                  <th className="p-3 text-right">Harga</th>
                  <th className="p-3 text-right">Stok Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{product.category_name || "-"}</td>
                    <td className="p-3 text-right">
                      Rp {Number(product.price).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3 text-right font-semibold">{totalStock(product)}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          product.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {product.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => void handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Harga (Rp)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>URL Gambar</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Varian & Stok</Label>
              {form.variants.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Ukuran"
                    value={v.size}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...variants[i], size: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Stok"
                    value={v.stock}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...variants[i], stock: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm({
                    ...form,
                    variants: [...form.variants, { size: "", stock: "0" }],
                  })
                }
              >
                + Varian
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
