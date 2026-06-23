import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AdminUser {
  type: "admin";
  id: number;
  username: string;
  email: string;
}

export interface BuyerUser {
  type: "buyer";
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export type User = AdminUser | BuyerUser;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginAsAdmin: (username: string, password: string) => Promise<void>;
  loginAsGoogle: (userInfo: Omit<BuyerUser, "type">) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to load user:", e);
      }
    }
    setLoading(false);
  }, []);

  const loginAsAdmin = async (username: string, password: string) => {
    // Simple validation - in production, this would be an API call
    if (username !== "adminfm" || password !== "Filkommerch123_wkwk") {
      throw new Error("Invalid username or password");
    }

    const adminUser: AdminUser = {
      type: "admin",
      id: 1,
      username,
      email: "admin@filkommerch.ub",
    };

    setUser(adminUser);
    localStorage.setItem("user", JSON.stringify(adminUser));
  };

  const loginAsGoogle = (userInfo: Omit<BuyerUser, "type">) => {
    const buyerUser: BuyerUser = {
      type: "buyer",
      ...userInfo,
    };

    setUser(buyerUser);
    localStorage.setItem("user", JSON.stringify(buyerUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginAsAdmin, loginAsGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
