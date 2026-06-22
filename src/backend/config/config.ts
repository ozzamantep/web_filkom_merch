// Environment variables configuration
export const config = {
  // Database
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "db_filkommerch",
    port: parseInt(process.env.DB_PORT || "3306"),
  },

  // Midtrans
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    isProduction: false, // Set to true untuk production
  },

  // API
  api: {
    url: process.env.VITE_API_URL || "http://localhost:5173/api",
  },
};

// Validate required env vars
export function validateConfig() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME", "MIDTRANS_SERVER_KEY", "MIDTRANS_CLIENT_KEY"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(", ")}`);
  }
}
