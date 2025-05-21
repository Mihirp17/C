import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { storage } from './storage';

// Create a memory store with an explicit limit
const SessionStore = MemoryStore(session);

// Session configuration
export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'my-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  store: new SessionStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  })
};

// Auth types
export type UserRole = 'platform_admin' | 'restaurant' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: number;
}

// Extend Express Request interface
declare module 'express-session' {
  interface SessionData {
    user: AuthUser;
  }
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'You must be logged in to access this resource' });
  }
  next();
};

// Role-based authorization middleware
export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ message: 'You must be logged in to access this resource' });
    }
    
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource' });
    }
    
    next();
  };
};

// Restaurant-specific authorization middleware
export const authorizeRestaurant = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'You must be logged in to access this resource' });
  }
  
  // If the user is a platform admin, they have access to all restaurants
  if (req.session.user.role === 'platform_admin') {
    return next();
  }
  
  // Check if restaurant ID in request matches the user's restaurant
  const requestedRestaurantId = parseInt(req.params.restaurantId);
  
  if (isNaN(requestedRestaurantId) || req.session.user.restaurantId !== requestedRestaurantId) {
    return res.status(403).json({ message: 'You do not have permission to access this restaurant\'s data' });
  }
  
  next();
};

// Authentication functions
export const loginPlatformAdmin = async (email: string, password: string): Promise<AuthUser | null> => {
  const admin = await storage.getPlatformAdminByEmail(email);
  
  if (!admin) {
    return null;
  }
  
  const isPasswordValid = await bcrypt.compare(password, admin.password);
  
  if (!isPasswordValid) {
    return null;
  }
  
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: 'platform_admin'
  };
};

export const loginRestaurant = async (email: string, password: string): Promise<AuthUser | null> => {
  const restaurant = await storage.getRestaurantByEmail(email);
  
  if (!restaurant) {
    return null;
  }
  
  const isPasswordValid = await bcrypt.compare(password, restaurant.password);
  
  if (!isPasswordValid) {
    return null;
  }
  
  return {
    id: restaurant.id,
    email: restaurant.email,
    name: restaurant.name,
    role: 'restaurant',
    restaurantId: restaurant.id
  };
};

export const loginUser = async (email: string, password: string): Promise<AuthUser | null> => {
  const user = await storage.getUserByEmail(email);
  
  if (!user) {
    return null;
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    return null;
  }
  
  return {
    id: user.id,
    email: user.email,
    name: user.name || email.split('@')[0],
    role: 'user',
    restaurantId: user.restaurantId
  };
};
