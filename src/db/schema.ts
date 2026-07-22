// Keep the schema entrypoint present so models can define tables and run
// `npx drizzle-kit push` without bootstrapping Drizzle config first.
import { pgTable, text, timestamp, serial, varchar, pgEnum, boolean } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["verifying", "queued", "in_progress", "complete", "rejected"]);

export const shoutouts = pgTable("shoutouts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  fromName: varchar("from_name", { length: 100 }),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  showHandleOnTv: boolean("show_handle_on_tv").default(false).notNull(),
  status: statusEnum("status").default("verifying"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const songRequests = pgTable("song_requests", {
  id: serial("id").primaryKey(),
  artist: varchar("artist", { length: 150 }).notNull(),
  title: varchar("title", { length: 150 }),
  anyTitle: boolean("any_title").default(false).notNull(),
  requesterName: varchar("requester_name", { length: 100 }),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  showHandleOnTv: boolean("show_handle_on_tv").default(false).notNull(),
  status: statusEnum("status").default("verifying"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fameSubmissions = pgTable("fame_submissions", {
  id: serial("id").primaryKey(),
  // Base64 fallback (used only when Supabase Storage is not configured)
  imageBase64: text("image_base64"),
  polaroidBase64: text("polaroid_base64"),
  // Supabase Storage public URLs (preferred - keeps DB small)
  imageUrl: text("image_url"),
  polaroidUrl: text("polaroid_url"),
  caption: text("caption"),
  name: varchar("name", { length: 100 }),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  showHandleOnTv: boolean("show_handle_on_tv").default(false).notNull(),
  status: statusEnum("status").default("verifying"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const instagramFollowers = pgTable("instagram_followers", {
  handle: varchar("handle", { length: 100 }).primaryKey(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: text("value").notNull(),
});

// End-of-night social media posts (9:16) generated in the DJ Console
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  postType: varchar("post_type", { length: 20 }).notNull(), // 'songs' | 'shoutouts' | 'photos'
  imageBase64: text("image_base64"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
