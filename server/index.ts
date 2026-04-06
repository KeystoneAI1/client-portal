import { config } from "dotenv";
config({ override: true });
import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { registerRoutes } from "./routes";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin");

    // Allow configured origins
    const allowedOrigins = (process.env.API_CORS_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    // Always allow localhost for development
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (allowedOrigins.includes(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }

      log(logLine);
    });

    next();
  });
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  const server = await registerRoutes(app);

  // Serve Expo web build (static files) in production
  const webDistPath = path.resolve(process.cwd(), "web-dist");
  if (fs.existsSync(webDistPath)) {
    log("Serving Expo web build from web-dist/");
    app.use(express.static(webDistPath));
    // SPA fallback: serve index.html for non-API routes
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(webDistPath, "index.html"));
      } else {
        next();
      }
    });
  }

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
