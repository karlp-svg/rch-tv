CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fame_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_url` text,
	`polaroid_url` text,
	`caption` text,
	`name` text,
	`instagram_handle` text,
	`show_handle_on_tv` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'verifying' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instagram_followers` (
	`handle` text PRIMARY KEY NOT NULL,
	`added_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shoutouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message` text NOT NULL,
	`from_name` text,
	`instagram_handle` text,
	`show_handle_on_tv` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'verifying' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_type` text NOT NULL,
	`image_url` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `song_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artist` text NOT NULL,
	`title` text,
	`any_title` integer DEFAULT 0 NOT NULL,
	`requester_name` text,
	`instagram_handle` text,
	`show_handle_on_tv` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'verifying' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
