import { pgTable, text, serial, integer, boolean, timestamp, decimal, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Platform Admin Model
export const platformAdmins = pgTable("platform_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Restaurant Model
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logo: text("logo"),
  address: text("address"),
  phone: text("phone"),
  email: text("email").notNull(),
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Subscription Model
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  status: text("status").notNull(), // active, canceled, past_due
  plan: text("plan").notNull(), // basic, premium
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Table Model
export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  qrCode: text("qr_code").notNull().unique(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  isOccupied: boolean("is_occupied").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Menu Item Model
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  image: text("image"),
  category: text("category"),
  isAvailable: boolean("is_available").default(true).notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Order Model
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  status: text("status").notNull(), // pending, confirmed, preparing, served, completed, cancelled
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  tableId: integer("table_id").notNull().references(() => tables.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Order Item Model
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// User Model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").notNull(), // admin or manager
  restaurantId: integer("restaurant_id").references(() => restaurants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Feedback Model
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  tableId: integer("table_id").notNull().references(() => tables.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Insert Schemas
export const insertPlatformAdminSchema = createInsertSchema(platformAdmins).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRestaurantSchema = createInsertSchema(restaurants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTableSchema = createInsertSchema(tables).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true, updatedAt: true });

// Select Types
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;

// Insert Types
export type InsertPlatformAdmin = z.infer<typeof insertPlatformAdminSchema>;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
