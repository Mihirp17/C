import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from 'express-session';
import { sessionConfig, authenticate, authorize, authorizeRestaurant, loginPlatformAdmin, loginRestaurant, loginUser } from "./auth";
import { setupWebSocketServer } from "./socket";
import { z } from "zod";
import { insertRestaurantSchema, insertUserSchema, insertMenuItemSchema, insertTableSchema, insertOrderSchema, insertOrderItemSchema, insertFeedbackSchema } from "@shared/schema";

import QRCode from 'qrcode';
import * as os from 'os';
import { generateRestaurantInsights, generateMenuOptimizationSuggestions, analyzeFeedbackSentiment } from "./ai";

// Schema for login requests
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Schema for date range
const dateRangeSchema = z.object({
  startDate: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s))
});

// Helper function to get local IP address
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (ifaceList) {
      for (const iface of ifaceList) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return 'localhost';
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("Starting route registration...");
  
  // Set up session
  console.log("Setting up session middleware...");
  app.use(session(sessionConfig));
  console.log("Session middleware set up successfully");
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
  });

  // Authentication Routes
  console.log("Setting up authentication routes...");
  app.post('/api/auth/login', async (req, res) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { email, password } = validation.data;
      let user = null;

      // Try to login as platform admin
      user = await loginPlatformAdmin(email, password);
      
      // If not admin, try restaurant
      if (!user) {
        user = await loginRestaurant(email, password);
      }
      
      // If not restaurant, try regular user
      if (!user) {
        user = await loginUser(email, password);
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Set user in session
      req.session.user = user;
      return res.json({ user });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'An error occurred during login' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.clearCookie('connect.sid');
      return res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
      return res.json({ user: req.session.user });
    }
    return res.status(401).json({ message: 'Not authenticated' });
  });
  console.log("Authentication routes set up successfully");

  // Restaurant Routes
  console.log("Setting up restaurant routes...");
  app.get('/api/restaurants', authenticate, authorize(['platform_admin']), async (req, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      return res.json(restaurants);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      return res.status(500).json({ message: 'Failed to fetch restaurants' });
    }
  });

  app.post('/api/restaurants', authenticate, authorize(['platform_admin']), async (req, res) => {
    try {
      const validation = insertRestaurantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const restaurant = await storage.createRestaurant(validation.data);
      return res.status(201).json(restaurant);
    } catch (error) {
      console.error('Error creating restaurant:', error);
      return res.status(500).json({ message: 'Failed to create restaurant' });
    }
  });

  app.get('/api/restaurants/:restaurantId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      return res.json(restaurant);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      return res.status(500).json({ message: 'Failed to fetch restaurant' });
    }
  });

  app.put('/api/restaurants/:restaurantId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertRestaurantSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedRestaurant = await storage.updateRestaurant(restaurantId, validation.data);
      if (!updatedRestaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      return res.json(updatedRestaurant);
    } catch (error) {
      console.error('Error updating restaurant:', error);
      return res.status(500).json({ message: 'Failed to update restaurant' });
    }
  });
  console.log("Restaurant routes set up successfully");

  // Table Routes
  console.log("Setting up table routes...");
  app.get('/api/restaurants/:restaurantId/tables', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const tables = await storage.getTablesByRestaurantId(restaurantId);
      return res.json(tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
      return res.status(500).json({ message: 'Failed to fetch tables' });
    }
  });

  app.post('/api/restaurants/:restaurantId/tables', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Generate QR code
      const tableNumber = req.body.number;
      // For development, use the local IP to make QR codes work from mobile devices
      let baseUrl = req.protocol + '://' + req.get('host');
      
      // If in development, prefer using the local IP address
      if (process.env.NODE_ENV === 'development') {
        const localIP = getLocalIP();
        const port = process.env.PORT || 5000;
        baseUrl = `http://${localIP}:${port}`;
      }
      
      const qrUrl = `${baseUrl}/menu/${restaurantId}/${tableNumber}`;
      const qrCode = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const validation = insertTableSchema.safeParse({
        ...req.body,
        restaurantId,
        qrCode
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const table = await storage.createTable(validation.data);
      return res.status(201).json(table);
    } catch (error) {
      console.error('Error creating table:', error);
      return res.status(500).json({ message: 'Failed to create table' });
    }
  });

  app.put('/api/restaurants/:restaurantId/tables/:tableId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableId = parseInt(req.params.tableId);
      
      if (isNaN(restaurantId) || isNaN(tableId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertTableSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedTable = await storage.updateTable(tableId, validation.data);
      if (!updatedTable) {
        return res.status(404).json({ message: 'Table not found' });
      }

      return res.json(updatedTable);
    } catch (error) {
      console.error('Error updating table:', error);
      return res.status(500).json({ message: 'Failed to update table' });
    }
  });

  app.delete('/api/restaurants/:restaurantId/tables/:tableId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableId = parseInt(req.params.tableId);
      
      if (isNaN(restaurantId) || isNaN(tableId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const deleted = await storage.deleteTable(tableId);
      if (!deleted) {
        return res.status(404).json({ message: 'Table not found' });
      }

      return res.json({ message: 'Table deleted successfully' });
    } catch (error) {
      console.error('Error deleting table:', error);
      return res.status(500).json({ message: 'Failed to delete table' });
    }
  });
  console.log("Table routes set up successfully");

  // Menu Item Routes
  console.log("Setting up menu item routes...");
  app.get('/api/restaurants/:restaurantId/menu-items', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const menuItems = await storage.getMenuItems(restaurantId);
      return res.json(menuItems);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      return res.status(500).json({ message: 'Failed to fetch menu items' });
    }
  });

  app.post('/api/restaurants/:restaurantId/menu-items', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = insertMenuItemSchema.safeParse({
        ...req.body,
        restaurantId
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const menuItem = await storage.createMenuItem(validation.data);
      return res.status(201).json(menuItem);
    } catch (error) {
      console.error('Error creating menu item:', error);
      return res.status(500).json({ message: 'Failed to create menu item' });
    }
  });

  app.put('/api/restaurants/:restaurantId/menu-items/:menuItemId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const menuItemId = parseInt(req.params.menuItemId);
      
      if (isNaN(restaurantId) || isNaN(menuItemId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertMenuItemSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedMenuItem = await storage.updateMenuItem(menuItemId, validation.data);
      if (!updatedMenuItem) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      return res.json(updatedMenuItem);
    } catch (error) {
      console.error('Error updating menu item:', error);
      return res.status(500).json({ message: 'Failed to update menu item' });
    }
  });

  app.delete('/api/restaurants/:restaurantId/menu-items/:menuItemId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const menuItemId = parseInt(req.params.menuItemId);
      
      if (isNaN(restaurantId) || isNaN(menuItemId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const deleted = await storage.deleteMenuItem(menuItemId);
      if (!deleted) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      return res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return res.status(500).json({ message: 'Failed to delete menu item' });
    }
  });
  console.log("Menu item routes set up successfully");

  // Order Routes
  console.log("Setting up order routes...");
  app.get('/api/restaurants/:restaurantId/orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const orders = await storage.getOrdersByRestaurantId(restaurantId);
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItemsByOrderId(order.id);
          return { ...order, items };
        })
      );

      return res.json(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/restaurants/:restaurantId/active-orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const orders = await storage.getActiveOrdersByRestaurantId(restaurantId);
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItemsByOrderId(order.id);
          return { ...order, items };
        })
      );

      return res.json(ordersWithItems);
    } catch (error) {
      console.error('Error fetching active orders:', error);
      return res.status(500).json({ message: 'Failed to fetch active orders' });
    }
  });

  app.post('/api/restaurants/:restaurantId/orders', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate order data
      const validation = insertOrderSchema.safeParse({
        ...req.body,
        restaurantId
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      // Validate that table exists and belongs to the restaurant
      const table = await storage.getTable(req.body.tableId);
      if (!table) {
        return res.status(400).json({ message: 'Table not found' });
      }
      if (table.restaurantId !== restaurantId) {
        return res.status(400).json({ message: 'Table does not belong to this restaurant' });
      }

      // Create the order
      const order = await storage.createOrder(validation.data);

      // Validate and create order items
      if (req.body.items && Array.isArray(req.body.items)) {
        if (req.body.items.length === 0) {
          return res.status(400).json({ message: 'Order must contain at least one item' });
        }

        for (const item of req.body.items) {
          // Validate that the menu item exists and belongs to the restaurant
          const menuItem = await storage.getMenuItem(item.menuItemId);
          if (!menuItem) {
            return res.status(400).json({ message: `Menu item with ID ${item.menuItemId} not found` });
          }
          if (menuItem.restaurantId !== restaurantId) {
            return res.status(400).json({ message: `Menu item ${item.menuItemId} does not belong to this restaurant` });
          }
          if (!menuItem.isAvailable) {
            return res.status(400).json({ message: `Menu item "${menuItem.name}" is currently unavailable` });
          }
          
          // Validate quantity
          if (!item.quantity || item.quantity < 1) {
            return res.status(400).json({ message: 'Item quantity must be at least 1' });
          }
          
          // Validate price matches the menu item price
          if (parseFloat(item.price) !== parseFloat(menuItem.price)) {
            return res.status(400).json({ message: `Price mismatch for item "${menuItem.name}". Expected ${menuItem.price}, got ${item.price}` });
          }

          await storage.createOrderItem({
            quantity: item.quantity,
            price: item.price,
            orderId: order.id,
            menuItemId: item.menuItemId
          });
        }
      } else {
        return res.status(400).json({ message: 'Order must contain items array' });
      }

      // Get the complete order with items
      const items = await storage.getOrderItemsByOrderId(order.id);
      
      // Fetch menu item details for each order item
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const menuItem = await storage.getMenuItem(item.menuItemId);
          return {
            ...item,
            menuItem
          };
        })
      );
      
      const completeOrder = { ...order, items: itemsWithDetails };
      
      // Send real-time notification to restaurant
      const { WebSocket } = await import('ws');
      const clients = (global as any).wsClients || [];
      
      // Send to all restaurant staff clients
      clients.forEach((client: any) => {
        if (
          client.restaurantId === restaurantId && 
          client.socket.readyState === WebSocket.OPEN
        ) {
          client.socket.send(JSON.stringify({
            type: 'new-order-received',
            payload: completeOrder
          }));
        }
      });

      return res.status(201).json(completeOrder);
    } catch (error) {
      console.error('Error creating order:', error);
      return res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.put('/api/restaurants/:restaurantId/orders/:orderId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const orderId = parseInt(req.params.orderId);
      
      if (isNaN(restaurantId) || isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertOrderSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedOrder = await storage.updateOrder(orderId, validation.data);
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Get the updated order with items
      const items = await storage.getOrderItemsByOrderId(orderId);
      const completeOrder = { ...updatedOrder, items };

      return res.json(completeOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      return res.status(500).json({ message: 'Failed to update order' });
    }
  });
  console.log("Order routes set up successfully");

  // Analytics Routes
  console.log("Setting up analytics routes...");
  app.post('/api/restaurants/:restaurantId/analytics/revenue', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const revenue = await storage.getRestaurantRevenue(restaurantId, startDate, endDate);
      return res.json({ revenue });
    } catch (error) {
      console.error('Error fetching revenue:', error);
      return res.status(500).json({ message: 'Failed to fetch revenue' });
    }
  });

  app.post('/api/restaurants/:restaurantId/analytics/orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const orderCount = await storage.getOrderCountByRestaurantId(restaurantId, startDate, endDate);
      return res.json({ orderCount });
    } catch (error) {
      console.error('Error fetching order count:', error);
      return res.status(500).json({ message: 'Failed to fetch order count' });
    }
  });

  app.post('/api/restaurants/:restaurantId/analytics/average-order', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const averageOrderValue = await storage.getAverageOrderValue(restaurantId, startDate, endDate);
      return res.json({ averageOrderValue });
    } catch (error) {
      console.error('Error fetching average order value:', error);
      return res.status(500).json({ message: 'Failed to fetch average order value' });
    }
  });

  app.get('/api/restaurants/:restaurantId/analytics/popular-items', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const popularItems = await storage.getPopularMenuItems(restaurantId, limit);
      return res.json(popularItems);
    } catch (error) {
      console.error('Error fetching popular items:', error);
      return res.status(500).json({ message: 'Failed to fetch popular items' });
    }
  });
  
  // AI Insights endpoints
  app.post('/api/restaurants/:restaurantId/analytics/ai-insights', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      
      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ 
          message: 'AI insights are not configured. Please add GEMINI_API_KEY to your environment variables.' 
        });
      }

      const insights = await generateRestaurantInsights(restaurantId, startDate, endDate);
      return res.json(insights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return res.status(500).json({ message: 'Failed to generate AI insights' });
    }
  });

  app.get('/api/restaurants/:restaurantId/menu-optimization', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ 
          message: 'AI insights are not configured. Please add GEMINI_API_KEY to your environment variables.' 
        });
      }

      const menuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
      const suggestions = await generateMenuOptimizationSuggestions(restaurantId, menuItems);
      
      return res.json({ suggestions });
    } catch (error) {
      console.error('Error generating menu optimization:', error);
      return res.status(500).json({ message: 'Failed to generate menu optimization suggestions' });
    }
  });

  app.post('/api/restaurants/:restaurantId/analyze-feedback', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const { feedback } = req.body;
      
      if (!feedback || typeof feedback !== 'string') {
        return res.status(400).json({ message: 'Feedback text is required' });
      }

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ 
          message: 'AI insights are not configured. Please add GEMINI_API_KEY to your environment variables.' 
        });
      }

      const analysis = await analyzeFeedbackSentiment(feedback);
      return res.json(analysis);
    } catch (error) {
      console.error('Error analyzing feedback:', error);
      return res.status(500).json({ message: 'Failed to analyze feedback' });
    }
  });
  
  console.log("Analytics routes set up successfully");

  // Feedback Routes
  console.log("Setting up feedback routes...");
  app.post('/api/restaurants/:restaurantId/feedback', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = insertFeedbackSchema.safeParse({
        ...req.body,
        restaurantId
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const feedback = await storage.createFeedback(validation.data);
      return res.status(201).json(feedback);
    } catch (error) {
      console.error('Error creating feedback:', error);
      return res.status(500).json({ message: 'Failed to create feedback' });
    }
  });

  app.get('/api/restaurants/:restaurantId/feedback', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const feedbackList = await storage.getFeedbackByRestaurantId(restaurantId);
      return res.json(feedbackList);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return res.status(500).json({ message: 'Failed to fetch feedback' });
    }
  });
  console.log("Feedback routes set up successfully");



  // Create HTTP server
  console.log("Creating HTTP server...");
  const httpServer = createServer(app);
  console.log("HTTP server created successfully");
  
  // Set up WebSockets
  console.log("Setting up WebSocket server...");
  setupWebSocketServer(httpServer);
  console.log("WebSocket server set up successfully");

  console.log("Route registration completed successfully");
  return httpServer;
}
