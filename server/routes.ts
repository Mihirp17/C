import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from 'express-session';
import { sessionConfig, authenticate, authorize, authorizeRestaurant, loginPlatformAdmin, loginRestaurant, loginUser } from "./auth";
import { setupWebSocketServer } from "./socket";
import { z } from "zod";
import { insertRestaurantSchema, insertUserSchema, insertMenuItemSchema, insertTableSchema, insertOrderSchema, insertOrderItemSchema, insertFeedbackSchema } from "@shared/schema";
import { stripe, createOrUpdateCustomer, createSubscription, updateSubscription, cancelSubscription, generateClientSecret, handleWebhookEvent, PLANS } from "./stripe";
import QRCode from 'qrcode';

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session
  app.use(session(sessionConfig));
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
  });

  // Authentication Routes
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

  // Restaurant Routes
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

  // Table Routes
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
      const baseUrl = req.protocol + '://' + req.get('host');
      const qrUrl = `${baseUrl}/menu/${restaurantId}/${tableNumber}`;
      const qrCode = await QRCode.toDataURL(qrUrl);

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

  // Menu Item Routes
  app.get('/api/restaurants/:restaurantId/menu-items', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const menuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
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

  // Order Routes
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

      // Create the order
      const order = await storage.createOrder(validation.data);

      // Create order items
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          await storage.createOrderItem({
            quantity: item.quantity,
            price: item.price,
            orderId: order.id,
            menuItemId: item.menuItemId
          });
        }
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

  // Analytics Routes
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

  // Feedback Routes
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

  // Subscription Routes
  app.post('/api/restaurants/:restaurantId/subscription', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      // Get or create customer
      const customer = await createOrUpdateCustomer(
        restaurantId,
        restaurant.email,
        restaurant.name
      );

      // Create subscription
      const planId = req.body.planId || PLANS.BASIC;
      const subscription = await createSubscription(
        restaurantId,
        customer.id,
        planId
      );

      // Get client secret for payment
      const clientSecret = await generateClientSecret(subscription.id);

      return res.json({
        subscriptionId: subscription.id,
        clientSecret
      });
    } catch (error) {
      console.error('Error creating subscription:', error);
      return res.status(500).json({ message: 'Failed to create subscription' });
    }
  });

  app.put('/api/restaurants/:restaurantId/subscription', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Get the current subscription
      const currentSubscription = await storage.getSubscriptionByRestaurantId(restaurantId);
      if (!currentSubscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      // Update the subscription
      const planId = req.body.planId;
      if (!planId) {
        return res.status(400).json({ message: 'Plan ID is required' });
      }

      const updatedSubscription = await updateSubscription(
        currentSubscription.stripeSubscriptionId,
        planId
      );

      return res.json({
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      return res.status(500).json({ message: 'Failed to update subscription' });
    }
  });

  app.delete('/api/restaurants/:restaurantId/subscription', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Get the current subscription
      const currentSubscription = await storage.getSubscriptionByRestaurantId(restaurantId);
      if (!currentSubscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      // Cancel the subscription
      const canceledSubscription = await cancelSubscription(
        currentSubscription.stripeSubscriptionId
      );

      // Update the status in the database
      await storage.updateSubscriptionByRestaurantId(restaurantId, {
        status: 'canceled'
      });

      return res.json({
        status: canceledSubscription.status
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return res.status(500).json({ message: 'Failed to cancel subscription' });
    }
  });

  // Stripe webhook handler
  app.post('/api/webhooks/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ message: 'Missing stripe signature or webhook secret' });
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      await handleWebhookEvent(event);
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(400).json({ message: 'Webhook error', error: (error as Error).message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSockets
  setupWebSocketServer(httpServer);

  return httpServer;
}
