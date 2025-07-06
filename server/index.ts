import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import * as https from "https";
import * as fs from "fs";
import cors from "cors";

// Debug logs to check environment variables
console.log("Starting server initialization...");
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);
console.log("STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY);

// Check for required environment variables
const requiredEnvVars = ['DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please create a .env file with these variables.');
  process.exit(1);
}

const app = express();

// Configure CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow localhost and production domains
    const allowedOrigins = [
      'http://localhost:5000',
      'https://localhost:5000',
      'http://localhost:3000',
      'https://localhost:3000',
      /^https?:\/\/192\.168\.\d+\.\d+:?\d*$/,  // Allow local network IPs
      /^https?:\/\/10\.\d+\.\d+\.\d+:?\d*$/,    // Allow local network IPs
    ];
    
    const isAllowed = allowedOrigins.some(allowed => 
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("Attempting to register routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

    // Error handling middleware
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      log(`Error: ${message}`);
    });

    // Setup Vite in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("Setting up development server with Vite...");
      await setupVite(app, server);
      console.log("Vite setup completed");
    } else {
      console.log("Setting up production server...");
      serveStatic(app);
      console.log("Static file serving setup completed");
    }

    const port = process.env.PORT || 5000;
    const host = '0.0.0.0'; // Listen on all interfaces instead of just localhost
    
    // Try to set up HTTPS server with self-signed certificates for development
    if (process.env.NODE_ENV === "development" && process.env.ENABLE_HTTPS !== 'false') {
      try {
        // Generate or use existing self-signed certificates
        const certPath = path.join(process.cwd(), 'server', 'certs');
        const keyPath = path.join(certPath, 'key.pem');
        const certFilePath = path.join(certPath, 'cert.pem');
        
        let httpsOptions: https.ServerOptions | null = null;
        
        if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
          httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certFilePath)
          };
          console.log("Using existing SSL certificates");
        } else {
          console.log("SSL certificates not found. Run 'npm run generate-certs' to create them.");
          console.log("Starting HTTP-only server...");
        }
        
        if (httpsOptions) {
          // Create HTTPS server
          const httpsServer = https.createServer(httpsOptions, app);
          
          // Set up WebSockets on HTTPS server
          const { setupWebSocketServer } = await import('./socket');
          setupWebSocketServer(httpsServer);
          
          httpsServer.listen(443, host, () => {
            console.log(`HTTPS Server running at https://localhost`);
            console.log(`Also accessible at https://${getLocalIP()}:443`);
          });
        }
      } catch (error) {
        console.error("Failed to set up HTTPS:", error);
      }
    }
    
    // Always start HTTP server
    server.listen(Number(port), host, () => {
      console.log(`HTTP Server running at http://localhost:${port}`);
      console.log(`Also accessible at http://${getLocalIP()}:${port}`);
      console.log("Environment: " + (process.env.NODE_ENV || "development"));
    });
  } catch (error) {
    console.error("Server startup failed with error:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }
})();

// Helper function to get local IP address
function getLocalIP() {
  const os = require('os');
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
