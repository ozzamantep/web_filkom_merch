import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Mail, Lock, LogIn, User, ArrowRight, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@frontend/components/ui/button";
import { Input } from "@frontend/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@frontend/components/ui/card";
import { Label } from "@frontend/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-fm.jpg";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign In — Filkom Merch UB" },
      { name: "description", content: "Access your Filkom Merch account" },
    ],
  }),
});

interface LocalAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
}

interface GoogleJwtPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
  hd?: string;
}

function LoginPage() {
  const { loginAsAdmin, loginAsGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "admin">("login");
  
  // Form fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Local accounts state
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);

  // Load registered buyers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("registeredBuyers");
      if (saved) {
        setAccounts(JSON.parse(saved));
      } else {
        // Seed a demo buyer account
        const demoAccount: LocalAccount = {
          id: "buyer_demo",
          name: "Brawijaya Buyer",
          username: "buyer",
          email: "buyer@student.ub.ac.id",
          password: "password123",
        };
        localStorage.setItem("registeredBuyers", JSON.stringify([demoAccount]));
        setAccounts([demoAccount]);
      }
    } catch (e) {
      console.error("Failed to load local accounts", e);
    }
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!name || !username || !email || !password) {
      toast.error("Semua field wajib diisi!");
      setLoading(false);
      return;
    }

    if (!email.endsWith("@student.ub.ac.id") && !email.includes("@")) {
      toast.error("Gunakan email UB atau email valid!");
      setLoading(false);
      return;
    }

    // Check if username or email already exists
    const exists = accounts.find((acc) => acc.username === username || acc.email === email);
    if (exists) {
      toast.error("Username atau Email sudah terdaftar!");
      setLoading(false);
      return;
    }

    const newAccount: LocalAccount = {
      id: "buyer_" + Math.random().toString(36).substr(2, 9),
      name,
      username,
      email,
      password,
    };

    const updatedAccounts = [...accounts, newAccount];
    localStorage.setItem("registeredBuyers", JSON.stringify(updatedAccounts));
    setAccounts(updatedAccounts);

    toast.success("Registrasi berhasil! Silakan login.");
    setMode("login");
    setPassword("");
    setLoading(false);
  };

  const handleBuyerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!username || !password) {
      toast.error("Username dan password wajib diisi!");
      setLoading(false);
      return;
    }

    // Find account by username or email
    const account = accounts.find(
      (acc) => (acc.username === username || acc.email === username) && acc.password === password
    );

    if (!account) {
      toast.error("Username atau password salah!");
      setLoading(false);
      return;
    }

    // Log in using loginAsGoogle handler from AuthContext (which sets type: "buyer")
    loginAsGoogle({
      id: account.id,
      email: account.email,
      name: account.name,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(account.name)}`,
    });

    toast.success(`Selamat datang kembali, ${account.name}!`);
    window.location.href = "/";
    setLoading(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginAsAdmin(username, password);
      toast.success("Logged in as Admin!");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (credentialResponse: any) => {
    setLoading(true);
    try {
      const token = credentialResponse.credential;
      if (!token) throw new Error("No credential returned");

      const decoded = jwtDecode<GoogleJwtPayload>(token);
      
      const isUB = decoded.hd === "student.ub.ac.id" || decoded.email.endsWith("@student.ub.ac.id");
      const organization = isUB ? "Universitas Brawijaya" : "Umum";

      loginAsGoogle({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      });

      toast.success(`Welcome, ${decoded.name}!`, {
        description: `Masuk sebagai civitas ${organization}`,
      });
      window.location.href = "/";
    } catch (error) {
      console.error("Google login failed", error);
      toast.error("Google login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error("Google login failed");
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-ink relative flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Decorative Warm Shapes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8 z-10 text-center animate-fade-in">
        <a href="/" className="flex flex-col items-center gap-3">
          <img
            src={logo}
            alt="Filkom Merch UB"
            className="h-16 w-16 rounded-full object-cover border-2 border-ink shadow-md transition-transform hover:scale-105 duration-300"
          />
          <div className="leading-tight">
            <h1 className="display text-3xl text-ink tracking-tight">Filkom Merch</h1>
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
              Universitas Brawijaya
            </p>
          </div>
        </a>
      </div>

      <Card className="w-full max-w-md border-2 border-ink shadow-[4px_4px_0px_0px_rgba(27,27,27,1)] bg-white z-10 transition-all duration-300">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            {mode === "login" && "Welcome Back"}
            {mode === "register" && "Create an Account"}
            {mode === "admin" && "Control Center Access"}
          </CardTitle>
          <CardDescription className="text-center text-sm text-muted-foreground">
            {mode === "login" && "Masuk untuk melanjutkan belanja merchandise resmi"}
            {mode === "register" && "Daftarkan akun pembeli baru dalam beberapa detik"}
            {mode === "admin" && "Hanya untuk administrator sistem Filkom Merch"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* BUYER LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleBuyerLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider">
                  Username or Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Masukkan username atau email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-ink text-cream hover:bg-brand-orange hover:text-white border-2 border-ink shadow-[2px_2px_0px_0px_rgba(27,27,27,1)] font-bold tracking-wider py-5 transition-all"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loading ? "MEMPROSES..." : "MASUK KE AKUN"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-muted"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-muted-foreground font-bold">ATAU</span>
                </div>
              </div>

              {/* Google Login Option */}
              <div className="flex justify-center w-full py-1">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  shape="pill"
                  theme="outline"
                  size="large"
                  text="signin_with"
                />
              </div>

              <div className="text-center pt-3 text-sm">
                <span className="text-muted-foreground">Belum punya akun? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setUsername("");
                    setPassword("");
                  }}
                  className="font-bold text-brand-orange hover:underline inline-flex items-center gap-1"
                >
                  Daftar Sekarang <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg bg-[#FAF8F5] border border-dashed border-ink/20 p-3 text-xs text-muted-foreground">
                <p className="font-bold text-ink">Demo Buyer Account:</p>
                <p>Username: buyer</p>
                <p>Password: password123</p>
              </div>
            </form>
          )}

          {/* BUYER REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs font-bold uppercase tracking-wider">
                  Nama Lengkap
                </Label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reg-name"
                    placeholder="Contoh: Muhammad Rafli"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-xs font-bold uppercase tracking-wider">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reg-username"
                    placeholder="Contoh: raflimand"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs font-bold uppercase tracking-wider">
                  Email Student/Valid
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="rafli@student.ub.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs font-bold uppercase tracking-wider">
                  Password Baru
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-ink text-cream hover:bg-brand-orange hover:text-white border-2 border-ink shadow-[2px_2px_0px_0px_rgba(27,27,27,1)] font-bold tracking-wider py-5 transition-all"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {loading ? "MENDAFTAR..." : "BUAT AKUN PEMBELI"}
              </Button>

              <div className="text-center pt-2 text-sm">
                <span className="text-muted-foreground">Sudah punya akun? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setUsername("");
                    setPassword("");
                  }}
                  className="font-bold text-brand-orange hover:underline"
                >
                  Login di sini
                </button>
              </div>
            </form>
          )}

          {/* ADMIN LOGIN FORM (SECRET) */}
          {mode === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4 animate-fade-in">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold">Sistem Administrasi Terproteksi</p>
                  <p>Halaman ini dikhususkan untuk tim operasional Filkom Merch.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-username" className="text-xs font-bold uppercase tracking-wider">
                  Admin Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-username"
                    placeholder="Masukkan admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs font-bold uppercase tracking-wider">
                  Admin Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-2 border-ink focus-visible:ring-0 focus-visible:border-brand-orange"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 text-white hover:bg-amber-700 border-2 border-ink shadow-[2px_2px_0px_0px_rgba(27,27,27,1)] font-bold tracking-wider py-5 transition-all"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loading ? "SIGNING IN..." : "VERIFY ADMIN ACCESS"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setUsername("");
                  setPassword("");
                }}
                className="w-full text-center text-xs font-bold text-muted-foreground hover:text-ink hover:underline pt-2 block"
              >
                Kembali ke Login Pembeli
              </button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center border-t border-muted bg-[#FAF9F6] py-4 text-[11px] text-muted-foreground font-medium rounded-b-lg relative">
          <span>Official Store of Fakultas Ilmu Komputer UB</span>
          
          {/* SECRET ADMIN BUTTON IN THE CORNER */}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "admin" ? "login" : "admin");
              setUsername("");
              setPassword("");
              toast.info(mode === "admin" ? "Beralih ke halaman pembeli" : "Secret Admin Panel diaktifkan!");
            }}
            aria-label="Secret admin button"
            className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-muted hover:bg-brand-orange transition-colors duration-300 opacity-60 hover:opacity-100"
          />
        </CardFooter>
      </Card>

      {/* Back to Home Button */}
      <a
        href="/"
        className="mt-6 text-xs font-bold tracking-widest text-muted-foreground hover:text-ink transition-colors z-10"
      >
        ← KEMBALI KE BERANDA
      </a>
    </div>
  );
}
