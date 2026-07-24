// Re-export PostgreSQL schema as the default schema
// For local dev / sandbox testing.
// When deploying to Cloudflare D1, replace this with:
//   export * from "./schema.d1";
export * from "./schema.pg";
