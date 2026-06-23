import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminSidebar } from "@frontend/components/admin/admin-sidebar";
import { Button } from "@frontend/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@frontend/components/ui/sheet";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.type !== "admin")) {
      void navigate({ to: "/login" });
    }
    if (!loading && user?.type === "admin" && user.role === "cashier") {
      void navigate({ to: "/pos" });
    }
  }, [user, loading, navigate]);

  if (loading || !user || user.type !== "admin" || user.role === "cashier") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Memuat panel admin...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex md:hidden items-center gap-3 border-b border-border bg-card px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <AdminSidebar onNavigate={() => {}} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Admin Panel</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
