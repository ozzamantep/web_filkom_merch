import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@frontend/components/ui/button";

export const Route = createFileRoute("/pos")({
  component: PosLayout,
});

function PosLayout() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.type !== "admin")) {
      void navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  if (loading || !user || user.type !== "admin") {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        Memuat POS...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-3">
          {user.role === "admin" && (
            <Button variant="ghost" size="sm" asChild className="text-zinc-300 hover:text-white">
              <Link to="/admin/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Admin
              </Link>
            </Button>
          )}
          <div>
            <p className="font-bold text-emerald-400">KASIR / POS OFFLINE</p>
            <p className="text-xs text-zinc-400">{user.username}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-white"
          onClick={() => {
            logout();
            void navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4 mr-1" />
          Keluar
        </Button>
      </header>

      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
