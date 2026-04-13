/**
 * Database type definitions
 *
 * We use a structural type instead of a union type because PostgreSQL and SQLite
 * database classes have incompatible method signatures. This allows us to use
 * the same code for both databases.
 */

import type * as schema from "./schema";

// Extract the shape of a drizzle database without the specific class type
export type DrizzleDB = {
  [K in keyof typeof schema]: (typeof schema)[K];
} & {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
  execute: (...args: any[]) => any;
  transaction: <T>(callback: (tx: any) => Promise<T>) => Promise<T>;
  query: {
    findMany: (...args: any[]) => any;
    findFirst: (...args: any[]) => any;
  };
};
