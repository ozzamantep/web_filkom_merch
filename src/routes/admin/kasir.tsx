import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { POSKasir } from "@/components/pos-kasir";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/kasir")({
  component: AdminKasirPage,
  head: () => ({
    meta: [
      { title: "Kasir — Admin Panel" },
      { name: "description", content: "Point of Sale System" },
    ],
  }),
});

function AdminKasirPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if user is admin
  useEffect(() => {
    if (!user || user.type !== "admin") {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  if (!user || user.type !== "admin") {
    return null;
  }

  const admin = user as any;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[2000px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: "/admin/dashboard" })}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Kasir Point of Sale</h1>
              <p className="text-sm text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{admin.username || admin.email}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
      </div>

      {/* POS Interface */}
      <POSKasir
        admin_id={admin.id || 1}
        admin_name={admin.username || admin.email}
        store_name="Filkom Merch UB"
      />
    </div>
  );
}
