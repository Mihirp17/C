import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

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

    const port = 5000;
    server.listen(port, "127.0.0.1", () => {
      console.log(`Server running at http://localhost:${port}`);
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
