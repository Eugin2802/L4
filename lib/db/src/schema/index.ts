import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("l4_profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  shopName: text("shop_name").notNull(),
  phone: text("phone").notNull(),
  avatarUrl: text("avatar_url"),
  acceptedTerms: boolean("accepted_terms").notNull().default(false),
  isAdult: boolean("is_adult").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("l4_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const products = pgTable("l4_products", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull(),
  categoryId: text("category_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  featured: boolean("featured").notNull().default(false),
  featuredUntil: timestamp("featured_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type L4OrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export const orders = pgTable("l4_orders", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull(),
  buyerId: text("buyer_id").notNull(),
  buyerName: text("buyer_name").notNull(),
  phone: text("phone").notNull(),
  tower: text("tower").notNull(),
  apartment: text("apartment").notNull(),
  desiredAt: text("desired_at"),
  paymentProofUrl: text("payment_proof_url"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  confirmed: boolean("confirmed").notNull().default(false),
  items: jsonb("items").$type<L4OrderLine[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable("l4_reviews", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("l4_reports", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reporterId: text("reporter_id").notNull(),
  reporterName: text("reporter_name").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  "l4_favorites",
  {
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

export const featuredRequests = pgTable("l4_featured_requests", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sellerId: text("seller_id").notNull(),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const adminSettings = pgTable("l4_admin_settings", {
  id: text("id").primaryKey(),
  featuredPrice: numeric("featured_price", { precision: 8, scale: 2 }).notNull().default("5"),
  paymentPhone: text("payment_phone").notNull().default(""),
  featuredDurationHours: integer("featured_duration_hours").notNull().default(24),
});