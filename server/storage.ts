import { 
  type PlatformAdmin, type InsertPlatformAdmin, platformAdmins,
  type Restaurant, type InsertRestaurant, restaurants,
  type Subscription, type InsertSubscription, subscriptions,
  type Table, type InsertTable, tables,
  type MenuItem, type InsertMenuItem, menuItems,
  type Order, type InsertOrder, orders,
  type OrderItem, type InsertOrderItem, orderItems,
  type User, type InsertUser, users,
  type Feedback, type InsertFeedback, feedback
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from 'bcryptjs';

// Generic storage interface with all required methods
export interface IStorage {
  // Platform Admin Methods
  getPlatformAdmin(id: number): Promise<PlatformAdmin | undefined>;
  getPlatformAdminByEmail(email: string): Promise<PlatformAdmin | undefined>;
  createPlatformAdmin(admin: InsertPlatformAdmin): Promise<PlatformAdmin>;

  // Restaurant Methods
  getRestaurant(id: number): Promise<Restaurant | undefined>;
  getRestaurantByEmail(email: string): Promise<Restaurant | undefined>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  getAllRestaurants(): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: number, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined>;
  
  // Subscription Methods
  getSubscription(id: number): Promise<Subscription | undefined>;
  getSubscriptionByRestaurantId(restaurantId: number): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  updateSubscriptionByRestaurantId(restaurantId: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  
  // Table Methods
  getTable(id: number): Promise<Table | undefined>;
  getTablesByRestaurantId(restaurantId: number): Promise<Table[]>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: number, table: Partial<InsertTable>): Promise<Table | undefined>;
  deleteTable(id: number): Promise<boolean>;
  
  // MenuItem Methods
  getMenuItem(id: number): Promise<MenuItem | undefined>;
  getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]>;
  createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, menuItem: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: number): Promise<boolean>;
  
  // Order Methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByRestaurantId(restaurantId: number): Promise<Order[]>;
  getActiveOrdersByRestaurantId(restaurantId: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  
  // OrderItem Methods
  getOrderItem(id: number): Promise<OrderItem | undefined>;
  getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  
  // User Methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRestaurantId(restaurantId: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Feedback Methods
  getFeedback(id: number): Promise<Feedback | undefined>;
  getFeedbackByRestaurantId(restaurantId: number): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;

  // Analytics Methods
  getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getPopularMenuItems(restaurantId: number, limit: number): Promise<{id: number, name: string, count: number, price: string}[]>;
  
  // Stripe related helpers
  updateRestaurantStripeInfo(restaurantId: number, stripeCustomerId: string, stripeSubscriptionId: string): Promise<Restaurant | undefined>;

  // Menu items method - unified interface
  getMenuItems(restaurantId: number): Promise<MenuItem[]>;
  
  // Seed data for testing
  seedMenuItems(restaurantId: number): Promise<void>;
}

// Sample menu items for seeding test data
const SAMPLE_MENU_ITEMS = [
  {
    name: "Classic Margherita",
    description: "Fresh tomatoes, mozzarella, basil, and olive oil",
    price: "12.99",
    category: "Pizza",
    isAvailable: true,
    image: null
  },
  {
    name: "Pepperoni Feast",
    description: "Loaded with pepperoni and extra cheese",
    price: "14.99",
    category: "Pizza",
    isAvailable: true,
    image: null
  },
  {
    name: "Garlic Bread",
    description: "Toasted bread with garlic butter and herbs",
    price: "5.99",
    category: "Starters",
    isAvailable: true,
    image: null
  },
  {
    name: "Caesar Salad",
    description: "Fresh romaine lettuce, croutons, parmesan, and Caesar dressing",
    price: "8.99",
    category: "Starters",
    isAvailable: true,
    image: null
  },
  {
    name: "Spaghetti Bolognese",
    description: "Classic pasta with meat sauce and parmesan",
    price: "13.99",
    category: "Pasta",
    isAvailable: true,
    image: null
  },
  {
    name: "Fettuccine Alfredo",
    description: "Creamy parmesan sauce with garlic and herbs",
    price: "12.99",
    category: "Pasta",
    isAvailable: true,
    image: null
  },
  {
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with a molten center, served with vanilla ice cream",
    price: "7.99",
    category: "Desserts",
    isAvailable: true,
    image: null
  },
  {
    name: "Tiramisu",
    description: "Classic Italian dessert with coffee-soaked ladyfingers and mascarpone cream",
    price: "6.99",
    category: "Desserts",
    isAvailable: true,
    image: null
  },
  {
    name: "Soft Drinks",
    description: "Choice of Coke, Sprite, Fanta, or Diet Coke",
    price: "2.99",
    category: "Drinks",
    isAvailable: true,
    image: null
  },
  {
    name: "Fresh Lemonade",
    description: "Homemade lemonade with mint",
    price: "3.99",
    category: "Drinks",
    isAvailable: true,
    image: null
  }
];

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Initialize default admin
    const admin = await this.getPlatformAdminByEmail('admin@restomate.com');
    if (!admin) {
      await this.createPlatformAdmin({
        email: 'admin@restomate.com',
        password: 'admin123',
        name: 'System Admin'
      });
    }

    // Initialize test restaurant if it doesn't exist
    const testRestaurant = await this.getRestaurant(2);
    if (!testRestaurant) {
      console.log('Test restaurant not found, creating it...');
      try {
        await this.createRestaurant({
          name: 'Demo Restaurant',
          email: 'restaurant@demo.com',
          password: 'password123',
          address: '123 Demo Street',
          phone: '+1234567890',
          slug: 'demo-restaurant'
        });
        console.log('Test restaurant created successfully');
      } catch (error) {
        console.log('Note: Test restaurant creation failed, may already exist');
      }
    }

    // Seed menu items for test restaurant if none exist
    const existingMenuItems = await this.getMenuItemsByRestaurantId(2);
    if (existingMenuItems.length === 0) {
      console.log('Seeding menu items for test restaurant...');
      await this.seedMenuItems(2);
    }
  }

  // Platform Admin Methods
  async getPlatformAdmin(id: number): Promise<PlatformAdmin | undefined> {
    const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, id));
    return admin;
  }

  async getPlatformAdminByEmail(email: string): Promise<PlatformAdmin | undefined> {
    const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, email));
    return admin;
  }

  async createPlatformAdmin(admin: InsertPlatformAdmin): Promise<PlatformAdmin> {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const [newAdmin] = await db
      .insert(platformAdmins)
      .values({ ...admin, password: hashedPassword })
      .returning();
    return newAdmin;
  }

  // Restaurant Methods
  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async getRestaurantByEmail(email: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.email, email));
    return restaurant;
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, slug));
    return restaurant;
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants);
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const hashedPassword = await bcrypt.hash(restaurant.password, 10);
    const [newRestaurant] = await db
      .insert(restaurants)
      .values({ ...restaurant, password: hashedPassword })
      .returning();
    return newRestaurant;
  }

  async updateRestaurant(id: number, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined> {
    // If password is included, hash it
    let updatedData = { ...restaurant };
    if (restaurant.password) {
      updatedData.password = await bcrypt.hash(restaurant.password, 10);
    }
    
    const [updatedRestaurant] = await db
      .update(restaurants)
      .set({ ...updatedData, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    return updatedRestaurant;
  }

  // Subscription Methods
  async getSubscription(id: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription;
  }

  async getSubscriptionByRestaurantId(restaurantId: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.restaurantId, restaurantId));
    return subscription;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }

  async updateSubscription(id: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updatedSubscription;
  }

  async updateSubscriptionByRestaurantId(restaurantId: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.restaurantId, restaurantId))
      .returning();
    return updatedSubscription;
  }

  // Table Methods
  async getTable(id: number): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.id, id));
    return table;
  }

  async getTablesByRestaurantId(restaurantId: number): Promise<Table[]> {
    return await db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
  }

  async createTable(table: InsertTable): Promise<Table> {
    const [newTable] = await db
      .insert(tables)
      .values(table)
      .returning();
    return newTable;
  }

  async updateTable(id: number, table: Partial<InsertTable>): Promise<Table | undefined> {
    const [updatedTable] = await db
      .update(tables)
      .set({ ...table, updatedAt: new Date() })
      .where(eq(tables.id, id))
      .returning();
    return updatedTable;
  }

  async deleteTable(id: number): Promise<boolean> {
    const result = await db
      .delete(tables)
      .where(eq(tables.id, id))
      .returning();
    return result.length > 0;
  }

  // MenuItem Methods
  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    const [menuItem] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return menuItem;
  }

  async getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    const [newMenuItem] = await db
      .insert(menuItems)
      .values(menuItem)
      .returning();
    return newMenuItem;
  }

  async updateMenuItem(id: number, menuItem: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [updatedMenuItem] = await db
      .update(menuItems)
      .set({ ...menuItem, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    return updatedMenuItem;
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    const result = await db
      .delete(menuItems)
      .where(eq(menuItems.id, id))
      .returning();
    return result.length > 0;
  }

  // Order Methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByRestaurantId(restaurantId: number): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId))
      .orderBy(desc(orders.createdAt));
  }

  async getActiveOrdersByRestaurantId(restaurantId: number): Promise<Order[]> {
    // Get orders that aren't completed or cancelled
    return await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          sql`${orders.status} NOT IN ('completed', 'cancelled')`
        )
      )
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db
      .insert(orders)
      .values(order)
      .returning();
    return newOrder;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  // OrderItem Methods
  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    const [orderItem] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return orderItem;
  }

  async getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values(orderItem)
      .returning();
    return newOrderItem;
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersByRestaurantId(restaurantId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.restaurantId, restaurantId));
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db
      .insert(users)
      .values({ ...user, password: hashedPassword })
      .returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    // If password is included, hash it
    let updatedData = { ...user };
    if (user.password) {
      updatedData.password = await bcrypt.hash(user.password, 10);
    }
    
    const [updatedUser] = await db
      .update(users)
      .set({ ...updatedData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Feedback Methods
  async getFeedback(id: number): Promise<Feedback | undefined> {
    const [feedbackItem] = await db.select().from(feedback).where(eq(feedback.id, id));
    return feedbackItem;
  }

  async getFeedbackByRestaurantId(restaurantId: number): Promise<Feedback[]> {
    return await db.select().from(feedback).where(eq(feedback.restaurantId, restaurantId));
  }

  async createFeedback(feedbackItem: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values(feedbackItem)
      .returning();
    return newFeedback;
  }

  // Analytics Methods
  async getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    const result = await db.select({
      revenue: sql<string>`SUM(${orders.total})`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        sql`${orders.createdAt} >= ${startDate}`,
        sql`${orders.createdAt} <= ${endDate}`,
        sql`${orders.status} != 'cancelled'`
      )
    );
    
    return result[0]?.revenue ? parseFloat(result[0].revenue) : 0;
  }

  async getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        sql`${orders.createdAt} >= ${startDate}`,
        sql`${orders.createdAt} <= ${endDate}`
      )
    );
    
    return result[0]?.count || 0;
  }

  async getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    const result = await db.select({
      average: sql<string>`AVG(${orders.total})`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        sql`${orders.createdAt} >= ${startDate}`,
        sql`${orders.createdAt} <= ${endDate}`,
        sql`${orders.status} != 'cancelled'`
      )
    );
    
    return result[0]?.average ? parseFloat(result[0].average) : 0;
  }

  async getPopularMenuItems(restaurantId: number, limit: number): Promise<{id: number, name: string, count: number, price: string}[]> {
    const result = await db.execute(sql`
      SELECT 
        mi.id, 
        mi.name, 
        mi.price, 
        COUNT(oi.id) as count
      FROM 
        ${menuItems} mi
      JOIN 
        ${orderItems} oi ON mi.id = oi.menu_item_id
      JOIN 
        ${orders} o ON oi.order_id = o.id
      WHERE 
        mi.restaurant_id = ${restaurantId}
      GROUP BY 
        mi.id, mi.name, mi.price
      ORDER BY 
        count DESC
      LIMIT ${limit}
    `);
    
    return result.rows.map(row => ({
      id: Number(row.id),
      name: row.name as string,
      count: Number(row.count),
      price: row.price as string
    }));
  }

  // Stripe Helpers
  async updateRestaurantStripeInfo(restaurantId: number, stripeCustomerId: string, stripeSubscriptionId: string): Promise<Restaurant | undefined> {
    // First check if subscription exists
    const existingSubscription = await this.getSubscriptionByRestaurantId(restaurantId);
    
    if (existingSubscription) {
      // Update existing subscription
      await this.updateSubscriptionByRestaurantId(restaurantId, {
        stripeCustomerId,
        stripeSubscriptionId
      });
    } else {
      // Create new subscription
      await this.createSubscription({
        restaurantId,
        stripeCustomerId,
        stripeSubscriptionId,
        status: 'active',
        plan: 'basic', // Default plan
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
    }
    
    return await this.getRestaurant(restaurantId);
  }

  // Menu items method - unified interface
  async getMenuItems(restaurantId: number): Promise<MenuItem[]> {
    // Fetch menu items from the database for the given restaurant
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  // Seed data for testing
  async seedMenuItems(restaurantId: number): Promise<void> {
    // Fetch existing menu items for the restaurant
    const existingMenuItems = await this.getMenuItemsByRestaurantId(restaurantId);

    // If no menu items exist for the restaurant, seed sample menu items
    if (existingMenuItems.length === 0) {
      console.log(`Seeding ${SAMPLE_MENU_ITEMS.length} menu items for restaurant ${restaurantId}`);
      for (const item of SAMPLE_MENU_ITEMS) {
        await this.createMenuItem({
          ...item,
          restaurantId,
          isAvailable: true,
          image: null
        });
      }
    }
  }
}

export const storage = new DatabaseStorage();
