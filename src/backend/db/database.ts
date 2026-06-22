import mysql from "mysql2/promise";
import { config } from "../config/config";

// Database configuration
const dbConfig = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  port: config.db.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function getConnection(): Promise<mysql.PoolConnection> {
  const pool = getPool();
  return pool.getConnection();
}

// Helper function untuk query
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(sql: string, values?: any[]): Promise<T[]> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(sql, values);
    return rows as T[];
  } finally {
    connection.release();
  }
}

// Helper untuk single row
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne<T>(sql: string, values?: any[]): Promise<T | null> {
  const results = await query<T>(sql, values);
  return results[0] || null;
}

// Helper untuk insert/update/delete
export async function execute(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values?: any[],
): Promise<{ insertId: number; affectedRows: number }> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute(sql, values);
    const resultSet = result as { insertId?: number; affectedRows?: number };
    return {
      insertId: resultSet.insertId || 0,
      affectedRows: resultSet.affectedRows || 0,
    };
  } finally {
    connection.release();
  }
}

// Close pool
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
