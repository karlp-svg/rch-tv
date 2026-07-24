// PostgreSQL schema (used for local dev / sandbox)
// Mirrors the D1 schema structure exactly but uses pg types
import { pgTable, text, integer, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const shoutouts = pgTable("shoutouts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  fromName: varchar("from_name", { length: 100 }),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  showHandleOnTv: integer("show_handle_on_tv").default(0).notNull(),
  status: text("status").default("verifying").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const songRequests = pgTable("song_requests", {
  id: serial("id").primaryKey(),
  artist: varchar("artist", { length: 150 }).notNull(),
  title: varchar("title", { length: 150 }),
  anyTitle: integer("any_title").default(0).notNull(),
  requesterName: varchar("requester_name", { length: 100 }),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  showHandleOnTv: integer("show_handle_on_tv").default(0).notNull(),
  status: text("status").default("verifying").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fameSubmissions = pgTable("fame_submissions", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url"),
  polaroidUrl: text("polaroid_url"),
  caption: text("caption"),
  name: varchar("name", { length: 100 }),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  showHandleOnTv: integer("show_handle_on_tv").default(0).notNull(),
  status: text("status").default("verifying").notNull(),
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

export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  postType: varchar("post_type", { length: 20 }).notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
