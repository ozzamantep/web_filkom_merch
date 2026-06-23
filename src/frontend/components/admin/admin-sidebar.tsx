import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  LogOut,
  Store,
  MonitorSmartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type AdminRole } from "@/lib/auth";
import { Button } from "@frontend/components/ui/button";
import { Separator } from "@frontend/components/ui/separator";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
}

const adminNavItems: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Produk", to: "/admin/products", icon: Package, roles: ["admin"] },
  { label: "Transaksi", to: "/admin/transactions", icon: Receipt, roles: ["admin"] },
  { label: "Pengaturan Toko", to: "/admin/settings", icon: Settings, roles: ["admin"] },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  if (!user || user.type !== "admin") return null;

  const role = user.role;
  const visibleItems = adminNavItems.filter((item) => item.roles.includes(role));
  const canAccessPos = role === "admin" || role === "cashier";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold leading-tight">FILKOM Merch</p>
          <p className="text-xs text-muted-foreground capitalize">{role} panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {canAccessPos && (
          <>
            <Separator className="my-3" />
            <Link
              to="/pos"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition-all",
                currentPath.startsWith("/pos")
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30",
              )}
            >
              <MonitorSmartphone className="h-5 w-5" />
              KASIR / POS
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium truncate">{user.username}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </aside>
  );
}
