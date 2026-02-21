import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// Lazily initialized — pool is not created until first use,
// ensuring DATABASE_URL is loaded from env before connection.
let _db: DrizzleDB | undefined;

function getDb(): DrizzleDB {
  if (!_db) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

export const db = new Proxy({} as DrizzleDB, {
  get(_, prop: string | symbol) {
    return Reflect.get(getDb(), prop, getDb());
  },
});

export type DB = DrizzleDB;
