import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Login — Filkom Merch UB" },
      { name: "description", content: "Sign in to your account" },
    ],
  }),
});

function LoginPage() {
  const { loginAsAdmin, loginAsGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<"admin" | "buyer">("buyer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginAsAdmin(username, password);
      toast.success("Logged in as admin!");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      // Simulate Google OAuth flow
      // In production, integrate with actual Google OAuth
      const userData = await simulateGoogleLogin();
      loginAsGoogle({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      });
      toast.success(`Welcome, ${userData.name}!`);
      window.location.href = "/";
    } catch (error) {
      toast.error("Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-orange flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl text-center">Filkom Merch</CardTitle>
          <CardDescription className="text-center">Sign in to your account</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("buyer")}
              className={`flex-1 py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "buyer"
                  ? "border-brand-blue text-brand-blue"
                  : "border-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Buyer
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex-1 py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "admin"
                  ? "border-brand-blue text-brand-blue"
                  : "border-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Buyer Login */}
          {activeTab === "buyer" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Sign in with your Google account to shop
              </p>
              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white text-foreground border border-border hover:bg-gray-50"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? "Signing in..." : "Sign in with Google"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-background text-muted-foreground">First time?</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                No account needed. Sign in with Google to start shopping.
              </p>
            </div>
          )}

          {/* Admin Login */}
          {activeTab === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="adminfm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Demo Credentials:</p>
                <p>Username: adminfm</p>
                <p>Password: Filkommerch123_wkwk</p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Mock Google Login
async function simulateGoogleLogin(): Promise<{
  id: string;
  email: string;
  name: string;
  picture: string;
}> {
  // In production, replace with actual Google OAuth flow
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: "google_" + Math.random().toString(36).substr(2, 9),
        email: "buyer@example.com",
        name: "John Doe",
        picture: "https://ui-avatars.com/api/?name=John+Doe",
      });
    }, 500);
  });
}
