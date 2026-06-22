import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Search,
  User,
  ShoppingBag,
  Instagram,
  Facebook,
  ArrowRight,
  Menu,
  X,
  Plus,
  Minus,
  Trash2,
  LogOut,
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { ProductWithVariants } from "@backend/server-actions";
import logo from "@/assets/logo-fm.jpg";
import hero from "@/assets/hero.jpg";
import pTshirt from "@/assets/p-tshirt.jpg";
import pHoodie from "@/assets/p-hoodie.jpg";
import pVarsity from "@/assets/p-varsity.jpg";
import pTote from "@/assets/p-tote.jpg";
import pCap from "@/assets/p-cap.jpg";
import pTee2 from "@/assets/p-tee2.jpg";
import about from "@/assets/about.jpg";

export const Route = createFileRoute("/")({
  loader: async (): Promise<ProductCard[]> => {
    const { getProducts } = await import("@backend/server-actions");
    const result = await getProducts();

    if (!result.products?.length) {
      return [];
    }

    return result.products.map((product: ProductWithVariants) => {
      const productName = product.name.toLowerCase();
      const cat: Filter =
        product.category_id === 2
          ? "ACCESSORIES"
          : productName.includes("hood")
            ? "HOODIE"
            : productName.includes("varsity") || productName.includes("jacket")
              ? "JACKET"
              : productName.includes("tee") || productName.includes("shirt")
                ? "TEE"
                : "ACCESSORIES";

      return {
        id: product.slug || `product-${product.id}`,
        img: product.image_url || pVarsity,
        name: product.name,
        price: `Rp ${product.price.toLocaleString("id-ID")}`,
        was: undefined,
        tag: "NEW",
        cat,
      };
    });
  },
  head: () => ({
    meta: [
      { title: "FILKOM Merch UB" },
      {
        name: "description",
        content:
          "Official merchandise dari mahasiswa Fakultas Ilmu Komputer Universitas Brawijaya. Jaket, hoodie, tee, dan aksesoris eksklusif.",
      },
      { property: "og:title", content: "FILKOM Merch UB" },
      {
        property: "og:description",
        content:
          "Official merchandise dari mahasiswa Fakultas Ilmu Komputer Universitas Brawijaya.",
      },
      { property: "og:image", content: logo },
    ],
    links: [
      { rel: "icon", href: logo },
      { rel: "shortcut icon", href: logo },
    ],
  }),
  component: Index,
});

const NAV: { label: string; target: string; filter?: string }[] = [
  { label: "NEW DROP", target: "shop", filter: "ALL" },
  { label: "JACKETS", target: "shop", filter: "JACKET" },
  { label: "HOODIES", target: "shop", filter: "HOODIE" },
  { label: "TEES", target: "shop", filter: "TEE" },
  { label: "ACCESSORIES", target: "shop", filter: "ACCESSORIES" },
  { label: "PRE-ORDER", target: "about" },
];

const FILTERS = ["ALL", "JACKET", "HOODIE", "TEE", "ACCESSORIES"] as const;
type Filter = (typeof FILTERS)[number];

type ProductCard = {
  id: string;
  img: string;
  name: string;
  price: string;
  was?: string;
  tag?: string;
  cat: Filter;
};

const FALLBACK_PRODUCTS: ProductCard[] = [
  {
    id: "varsity-jacket",
    img: pVarsity,
    name: "Varsity Jacket — Filkom '25",
    price: "Rp 450.000",
    was: "Rp 525.000",
    tag: "BEST SELLER",
    cat: "JACKET",
  },
  {
    id: "heavyweight-hoodie-navy",
    img: pHoodie,
    name: "Heavyweight Hoodie Navy",
    price: "Rp 285.000",
    was: "Rp 320.000",
    tag: "-10%",
    cat: "HOODIE",
  },
  { id: "essential-tee-navy", img: pTshirt, name: "Essential Tee — Navy", price: "Rp 125.000", tag: "NEW", cat: "TEE" },
  { id: "graphic-tee-forpt", img: pTee2, name: "Graphic Tee — Forpt Cantcont", price: "Rp 145.000", tag: "NEW", cat: "TEE" },
  { id: "f-logo-snapback", img: pCap, name: "F Logo Snapback", price: "Rp 95.000", cat: "ACCESSORIES" },
  { id: "canvas-tote-logo", img: pTote, name: "Canvas Tote — Logo Stamp", price: "Rp 65.000", cat: "ACCESSORIES" },
];

const CATEGORIES: { name: string; img: string; filter: Filter }[] = [
  { name: "Varsity Jacket", img: pVarsity, filter: "JACKET" },
  { name: "Hoodie", img: pHoodie, filter: "HOODIE" },
  { name: "T-Shirt", img: pTshirt, filter: "TEE" },
  { name: "Accessories", img: pCap, filter: "ACCESSORIES" },
];

type CartItem = { id: string; name: string; price: string; img: string; qty: number };

function parsePrice(p: string) {
  return Number(p.replace(/[^0-9]/g, ""));
}

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Index() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  // Load cart from localStorage only on client (after hydration)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("indexCart");
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
      }
    } catch {
      // ignore
    }
    setCartLoaded(true);
  }, []);

  // Sync cart ke localStorage setiap kali berubah (setelah load awal)
  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem("indexCart", JSON.stringify(cart));
    }
  }, [cart, cartLoaded]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const dbProducts = Route.useLoaderData();

  const products = dbProducts.length > 0 ? dbProducts : FALLBACK_PRODUCTS;

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);

  const visibleProducts = useMemo(() => {
    let list = products;
    if (filter !== "ALL") list = list.filter((p) => p.cat === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, query, products]);

  const addToCart = useCallback((p: ProductCard) => {
    setCart((c) => {
      const existing = c.find((i) => i.id === p.id);
      if (existing) return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { id: p.id, name: p.name, price: p.price, img: p.img, qty: 1 }];
    });
    setCartOpen(true);
    toast.success("Added to bag", { description: p.name });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((c) => c.filter((i) => i.id !== id));
  }, []);

  const handleNav = (item: (typeof NAV)[number]) => {
    setMenuOpen(false);
    if (item.filter) setFilter(item.filter as Filter);
    scrollToId(item.target);
  };

  const handleCheckout = () => {
    if (!cart.length) {
      toast.error("Your cart is empty");
      return;
    }

    if (!user) {
      toast.error("Please sign in to checkout");
      navigate({ to: "/login" });
      return;
    }

    // Convert cart items to the format expected by checkout page
    const checkoutCart = cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: parsePrice(item.price),
      quantity: item.qty,
      category: item.name.includes("Varsity")
        ? "JACKET"
        : item.name.includes("Hoodie")
          ? "HOODIE"
          : item.name.includes("Tee")
            ? "TEE"
            : "ACCESSORIES",
    }));

    // Save to localStorage in the format checkout expects
    localStorage.setItem("cart", JSON.stringify(checkoutCart));

    // Navigate to checkout
    navigate({ to: "/checkout" });
    setCartOpen(false);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Email tidak valid");
      return;
    }
    toast.success("Subscribed!", { description: `Drop berikutnya dikirim ke ${email}` });
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Announcement marquee */}
      <div className="bg-ink text-cream py-2 overflow-hidden border-b border-ink">
        <div className="flex marquee-track whitespace-nowrap text-xs tracking-[0.2em] font-medium">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex shrink-0 items-center gap-10 px-5">
              {[
                "OFFICIAL FILKOM UB MERCHANDISE",
                "FREE ONGKIR KE FILKOM ★",
                "PRE-ORDER VARSITY '25 OPEN",
                "100% PRODUK MAHASISWA",
                "CASHBACK 5% MEMBER",
                "DROP BARU TIAP BULAN",
              ].map((t) => (
                <span key={t} className="flex items-center gap-10">
                  {t}
                  <span className="text-brand-orange">●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 flex items-center justify-between h-20">
          <button onClick={() => scrollToId("top")} className="flex items-center gap-3 text-left">
            <img
              src={logo}
              alt="Filkom Merch UB"
              className="h-12 w-12 rounded-full object-cover ring-2 ring-ink"
            />
            <div className="leading-tight">
              <div className="display text-lg text-ink">Filkom Merch</div>
              <div className="text-[10px] tracking-[0.3em] text-muted-foreground">
                UNIVERSITAS BRAWIJAYA
              </div>
            </div>
          </button>
          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map((n) => (
              <button
                key={n.label}
                onClick={() => handleNav(n)}
                className="text-xs font-semibold tracking-[0.18em] text-ink hover:text-brand-orange transition-colors"
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-ink">
            <button aria-label="Search" onClick={() => setSearchOpen((v) => !v)}>
              <Search className="w-5 h-5" />
            </button>
            <div className="relative">
              <button aria-label="Account" onClick={() => setUserMenuOpen((v) => !v)}>
                <User className="w-5 h-5" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg z-50">
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold text-foreground">
                          {user.type === "admin" ? user.username : user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <span className="inline-block mt-1 px-2 py-1 text-[10px] font-bold bg-blue-100 text-blue-900 rounded">
                          {user.type === "admin" ? "ADMIN" : "BUYER"}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                          toast.success("Logged out");
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      className="block px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                  )}
                </div>
              )}
            </div>
            <button aria-label="Cart" className="relative" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-brand-orange text-cream text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
            <button aria-label="Menu" className="lg:hidden" onClick={() => setMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
        {searchOpen && (
          <div className="border-t border-border bg-background">
            <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-4 flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value) scrollToId("shop");
                }}
                placeholder="Cari produk…"
                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted-foreground"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      <div id="top" />

      {/* Hero */}
      <section className="relative">
        <div className="grid lg:grid-cols-12 max-w-[1400px] mx-auto">
          <div className="lg:col-span-5 px-5 lg:px-10 py-14 lg:py-24 flex flex-col justify-center order-2 lg:order-1">
            <div className="text-xs tracking-[0.3em] text-brand-orange font-semibold mb-5">
              FILKOM MERCH 2026
            </div>
            <h1 className="display text-[64px] sm:text-[88px] lg:text-[120px] leading-[0.85] text-ink">
              Wear
              <br />
              Your
              <br />
              <span className="text-brand-orange">Faculty.</span>
            </h1>
            <p className="mt-7 text-base text-muted-foreground max-w-md">
              Koleksi merchandise resmi mahasiswa Fakultas Ilmu Komputer UB. Dibuat oleh mahasiswa,
              untuk mahasiswa premium, eksklusif, dan limited stock.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  setFilter("ALL");
                  scrollToId("shop");
                }}
                className="inline-flex items-center gap-2 bg-ink text-cream px-7 py-4 text-xs font-bold tracking-[0.2em] hover:bg-brand-blue transition-colors"
              >
                SHOP THE DROP <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollToId("about")}
                className="inline-flex items-center px-7 py-4 text-xs font-bold tracking-[0.2em] border border-ink text-ink hover:bg-ink hover:text-cream transition-colors"
              >
                LOOKBOOK
              </button>
            </div>
            <div className="mt-12 flex items-center gap-8 text-xs tracking-widest text-muted-foreground">
              <div>
                <span className="display text-2xl text-ink block">12K+</span>STUDENTS
              </div>
              <div>
                <span className="display text-2xl text-ink block">48</span>DESIGNS
              </div>
              <div>
                <span className="display text-2xl text-ink block">4.9★</span>RATING
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 relative order-1 lg:order-2 bg-brand-blue">
            <img
              src={hero}
              alt="Filkom Merch lookbook"
              width={1600}
              height={1100}
              className="w-full h-[60vh] lg:h-[85vh] object-cover mix-blend-luminosity opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-blue/40 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-cream">
              <div className="display text-3xl lg:text-5xl leading-none">
                EST.
                <br />
                FILKOM
              </div>
              <div className="text-right text-[10px] tracking-[0.3em]">
                SS / 26
                <br />
                COLLECTION
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-cream border-y border-border">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-xs tracking-[0.3em] text-muted-foreground mb-2">
                01 — CATEGORIES
              </div>
              <h2 className="display text-4xl lg:text-6xl text-ink">Pick your fit.</h2>
            </div>
            <button
              onClick={() => {
                setFilter("ALL");
                scrollToId("shop");
              }}
              className="hidden md:inline-flex text-xs font-bold tracking-[0.2em] text-ink hover:text-brand-orange"
            >
              VIEW ALL →
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setFilter(c.filter);
                  scrollToId("shop");
                }}
                className="group relative overflow-hidden bg-background aspect-[3/4] text-left"
              >
                <img
                  src={c.img}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 flex items-center justify-between text-cream">
                  <span className="display text-xl">{c.name}</span>
                  <ArrowRight className="w-5 h-5 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section id="shop" className="max-w-[1400px] mx-auto px-5 lg:px-10 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs tracking-[0.3em] text-muted-foreground mb-2">
              02 — LATEST DROP
            </div>
            <h2 className="display text-4xl lg:text-6xl text-ink">New arrivals.</h2>
          </div>
          <div className="hidden md:flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-bold tracking-[0.18em] px-4 py-2 border transition-colors ${filter === f ? "bg-ink text-cream border-ink" : "border-border text-ink hover:border-ink"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 text-[11px] font-bold tracking-[0.18em] px-3 py-2 border transition-colors ${filter === f ? "bg-ink text-cream border-ink" : "border-border text-ink"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-12">
          {visibleProducts.map((p) => (
            <article key={p.name} className="group">
              <div className="relative aspect-[4/5] bg-secondary overflow-hidden">
                <img
                  src={p.img}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                {p.tag && (
                  <span
                    className={`absolute top-3 left-3 text-[10px] font-bold tracking-[0.15em] px-2.5 py-1 ${p.tag === "NEW" ? "bg-ink text-cream" : "bg-brand-orange text-cream"}`}
                  >
                    {p.tag}
                  </span>
                )}
                <button
                  onClick={() => addToCart(p)}
                  className="absolute bottom-0 left-0 right-0 bg-ink text-cream py-3 text-[11px] font-bold tracking-[0.2em] lg:translate-y-full lg:group-hover:translate-y-0 transition-transform duration-300 hover:bg-brand-orange"
                >
                  + ADD TO BAG
                </button>
              </div>
              <div className="pt-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-1">
                    {p.cat}
                  </div>
                  <h3 className="text-sm font-semibold text-ink leading-snug normal-case">
                    {p.name}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-ink">{p.price}</div>
                  {p.was && (
                    <div className="text-xs text-muted-foreground line-through">{p.was}</div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {visibleProducts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="display text-3xl text-ink mb-2">No products found.</p>
            <button
              onClick={() => {
                setFilter("ALL");
                setQuery("");
              }}
              className="text-xs font-bold tracking-[0.2em] text-brand-orange"
            >
              RESET FILTERS →
            </button>
          </div>
        )}
      </section>

      {/* Banner stripe */}
      <section className="bg-brand-orange text-ink overflow-hidden">
        <div className="flex marquee-track whitespace-nowrap py-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex shrink-0 items-center gap-8 px-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <span key={j} className="display text-4xl lg:text-6xl flex items-center gap-8">
                  FILKOM MERCH <span className="text-ink/30">✦</span> UNIVERSITAS BRAWIJAYA{" "}
                  <span className="text-ink/30">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-cream">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="aspect-[4/5] overflow-hidden bg-secondary">
            <img
              src={about}
              alt="Mahasiswa Filkom UB"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="text-xs tracking-[0.3em] text-brand-orange font-semibold mb-4">
              03 — TENTANG KAMI
            </div>
            <h2 className="display text-5xl lg:text-7xl text-ink leading-none">
              Lebih dari
              <br />
              sekadar
              <br />
              <span className="text-brand-blue">merch.</span>
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Filkom Merch UB lahir dari semangat mahasiswa Fakultas Ilmu Komputer Universitas
              Brawijaya untuk menciptakan identitas yang dapat dipakai sehari-hari — bukan sekadar
              seragam, tapi simbol kebanggaan dan kebersamaan satu angkatan.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Setiap produk didesain in-house, diproduksi dalam jumlah terbatas, dan menggunakan
              bahan premium. Karena kebanggaan Filkom layak dipakai dengan baik.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-8">
              <div>
                <div className="display text-3xl text-ink">100%</div>
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground mt-1">
                  MAHASISWA FILKOM
                </div>
              </div>
              <div>
                <div className="display text-3xl text-ink">PREMIUM</div>
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground mt-1">
                  BAHAN PILIHAN
                </div>
              </div>
              <div>
                <div className="display text-3xl text-ink">LIMITED</div>
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground mt-1">
                  EVERY DROP
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-ink text-cream">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <h2 className="display text-4xl lg:text-6xl leading-none">
            Jangan ketinggalan
            <br />
            <span className="text-brand-orange">drop berikutnya.</span>
          </h2>
          <form className="flex flex-col gap-3" onSubmit={handleSubscribe}>
            <label className="text-xs tracking-[0.3em] text-cream/70">EMAIL MAHASISWA</label>
            <div className="flex border-b border-cream/40 pb-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@student.ub.ac.id"
                className="flex-1 bg-transparent outline-none placeholder:text-cream/40 text-cream"
              />
              <button
                type="submit"
                className="text-xs font-bold tracking-[0.2em] text-brand-orange hover:text-cream"
              >
                SUBSCRIBE →
              </button>
            </div>
            <p className="text-xs text-cream/50 mt-2">
              Dapat info drop pertama + diskon eksklusif member.
            </p>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-14 grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="" className="w-10 h-10 rounded-full" />
              <span className="display text-lg text-ink">Filkom Merch</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Gedung A Fakultas Ilmu Komputer, Universitas Brawijaya, Malang.
            </p>
            <div className="flex gap-3 mt-5 text-ink">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="hover:text-brand-orange"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="hover:text-brand-orange"
              >
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
          {[
            { title: "SHOP", items: ["New Drop", "Jackets", "Hoodies", "Tees", "Accessories"] },
            { title: "BANTUAN", items: ["Size Guide", "Shipping", "Returns", "FAQ"] },
            { title: "TENTANG", items: ["Cerita Kami", "Lookbook", "Kontak", "Pre-Order"] },
          ].map((col) => (
            <div key={col.title}>
              <div className="text-xs font-bold tracking-[0.2em] text-ink mb-4">{col.title}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.items.map((i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        scrollToId(col.title === "SHOP" ? "shop" : "about");
                      }}
                      className="hover:text-ink text-left"
                    >
                      {i}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-5 flex flex-col md:flex-row justify-between gap-2 text-xs text-muted-foreground">
            <div>© 2026 Filkom Merch UB · Official student merchandise.</div>
            <div>Made with ♥ in Malang.</div>
          </div>
        </div>
      </footer>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-ink text-cream flex flex-col">
          <div className="flex items-center justify-between px-5 h-20 border-b border-cream/20">
            <span className="display text-lg">Filkom Merch</span>
            <button
              onClick={() => {
                setMenuOpen(false);
                setUserMenuOpen(false);
              }}
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 flex flex-col px-5 py-8 gap-1">
            {NAV.map((n) => (
              <button
                key={n.label}
                onClick={() => {
                  handleNav(n);
                  setUserMenuOpen(false);
                }}
                className="display text-4xl text-left py-3 hover:text-brand-orange transition-colors"
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-ink/50 backdrop-blur-sm"
            onClick={() => {
              setCartOpen(false);
              setUserMenuOpen(false);
            }}
          />
          <aside className="w-full max-w-md bg-background text-foreground flex flex-col shadow-2xl">
            <div className="flex items-center justify-between h-20 px-6 border-b border-border">
              <div>
                <div className="display text-2xl text-ink">Your Bag</div>
                <div className="text-[10px] tracking-[0.3em] text-muted-foreground">
                  {cartCount} ITEM
                </div>
              </div>
              <button
                onClick={() => {
                  setCartOpen(false);
                  setUserMenuOpen(false);
                }}
                aria-label="Close cart"
              >
                <X className="w-5 h-5 text-ink" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cart.length === 0 ? (
                <div className="text-center py-20">
                  <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                  <p className="display text-2xl text-ink">Bag is empty.</p>
                  <p className="text-sm text-muted-foreground mt-2">Tambahkan produk favoritmu.</p>
                  <button
                    onClick={() => {
                      setCartOpen(false);
                      scrollToId("shop");
                    }}
                    className="mt-6 inline-flex items-center gap-2 bg-ink text-cream px-6 py-3 text-xs font-bold tracking-[0.2em] hover:bg-brand-orange"
                  >
                    BROWSE PRODUCTS <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                    {cart.map((i) => (
                    <li key={i.id} className="py-4 flex gap-4">
                      <img src={i.img} alt="" className="w-20 h-24 object-cover" />
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between gap-2">
                          <h4 className="text-sm font-semibold text-ink leading-snug">{i.name}</h4>
                          <button onClick={() => removeItem(i.id)} aria-label="Remove">
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-brand-orange" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="inline-flex items-center border border-border">
                            <button
                              onClick={() => updateQty(i.id, -1)}
                              className="px-2 py-1.5 hover:bg-secondary"
                              aria-label="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-3 text-sm font-bold">{i.qty}</span>
                            <button
                              onClick={() => updateQty(i.id, 1)}
                              className="px-2 py-1.5 hover:bg-secondary"
                              aria-label="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-ink">
                            {formatRp(parsePrice(i.price) * i.qty)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-border px-6 py-5 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold text-ink">{formatRp(cartTotal)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full bg-ink text-cream py-4 text-xs font-bold tracking-[0.2em] hover:bg-brand-orange transition-colors inline-flex items-center justify-center gap-2"
                >
                  CHECKOUT <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
