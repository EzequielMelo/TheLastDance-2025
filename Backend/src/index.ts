import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Import routes
import authRoutes from "./auth/authRoutes";
import menuRoutes from "./modules/menu/menuRoutes";

const app = express();
const PORT = parseInt(process.env["PORT"] || "3000", 10);

// Security middleware (solo en prod)
if (process.env["NODE_ENV"] === "production") {
  app.use(helmet());
}

// CORS configuration
app.use(
  cors({
    origin:
      process.env["NODE_ENV"] === "production"
        ? process.env["FRONTEND_URL"]
        : "*",
    credentials: true,
  }),
);

// Logging middleware
app.use(morgan(process.env["NODE_ENV"] === "production" ? "combined" : "dev"));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env["NODE_ENV"] || "development",
  });
});

// API Routes (comentar si no existen aún)
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
/*
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
*/

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handling middleware
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env["NODE_ENV"] === "development" && err instanceof Error
          ? err.message
          : "Something went wrong",
    });
  },
);

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Server running on port ${PORT} in ${process.env["NODE_ENV"] || "development"} mode`,
  );
  console.log(`📍 Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
const handleSignal = (sig: NodeJS.Signals) => {
  console.log(`${sig} signal received.`);
  server.close(() => {
    console.log("HTTP server closed.");
    // ⬇️ Solo cerramos el proceso en producción; en dev,
    // dejá que nodemon maneje el reinicio sin hacer exit manual.
    if (process.env["NODE_ENV"] === "production") {
      process.exit(0);
    }
  });
};

process.on("SIGTERM", handleSignal);
process.on("SIGINT", handleSignal);

// Opcional: cuando nodemon reinicia suele mandar SIGUSR2
process.on("SIGUSR2", () => {
  console.log("SIGUSR2 received (nodemon restart).");
  server.close(() => {
    console.log("HTTP server closed (nodemon).");
    // no process.exit() en dev
  });
});

export default app;
