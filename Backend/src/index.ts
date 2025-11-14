import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { setupSocketIO } from "./socket/chatSocket";
import { setupDeliveryChatSocket } from "./socket/deliveryChatSocket";

// Import routes
import authRoutes from "./auth/authRoutes";
import menuRoutes from "./modules/menu/menuRoutes";
import adminRoutes from "./modules/admin/adminRoutes";
import tablesRoutes from "./modules/tables/tablesRoutes";
import ordersRoutes from "./modules/orders/ordersRoutes";
import waiterRoutes from "./modules/waiter/waiterRoutes";
import chatRoutes from "./modules/chat/chatRoutes";
import { invoiceRoutes } from "./modules/invoices/invoiceRoutes";
import reservationsRoutes from "./modules/reservations/reservationsRoutes";
import deliveryRoutes from "./modules/delivery/deliveryRoutes";
import deliveryOrdersRoutes from "./modules/delivery/deliveryOrdersRoutes";
import deliveryChatRoutes from "./modules/delivery/deliveryChatRoutes";

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

// Root endpoint - Página de bienvenida
app.get("/", (_req, res) => {
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>The Last Dance - Restaurant API</title>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%);
          color: #fff;
          margin: 0;
          padding: 2rem;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          max-width: 600px;
          padding: 2rem;
          border: 1px solid #d4af37;
          border-radius: 12px;
          background: rgba(0,0,0,0.3);
        }
        h1 { color: #d4af37; margin-bottom: 1rem; }
        .status { color: #22c55e; font-weight: bold; }
        .endpoints { 
          background: rgba(0,0,0,0.5); 
          padding: 1rem; 
          border-radius: 8px; 
          margin: 1rem 0; 
          text-align: left;
        }
        .endpoint { 
          margin: 0.5rem 0; 
          font-family: monospace; 
          color: #d4af37; 
        }
        .info { color: #9ca3af; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🍽️ The Last Dance Restaurant API</h1>
        <p class="status">✅ Servidor activo y funcionando</p>
        
        <div class="info">
          <p><strong>Uptime:</strong> ${uptimeFormatted}</p>
          <p><strong>Ambiente:</strong> ${process.env["NODE_ENV"] || "development"}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        
        <div class="endpoints">
          <h3>📡 Endpoints disponibles:</h3>
          <div class="endpoint">GET /health - Estado del servidor</div>
          <div class="endpoint">GET /ping - Ping rápido</div>
          <div class="endpoint">POST /api/auth/* - Autenticación</div>
          <div class="endpoint">GET /api/tables/* - Gestión de mesas</div>
          <div class="endpoint">GET /api/menu/* - Menú del restaurante</div>
          <div class="endpoint">GET /api/admin/* - Panel administrativo</div>
          <div class="endpoint">GET /api/waiter/* - Gestión de meseros</div>
        </div>
        
        <p class="info">
          Backend desarrollado para The Last Dance Restaurant<br>
          Sistema de gestión de mesas y reservas
        </p>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env["NODE_ENV"] || "development",
  });
});

// Ping endpoint para UptimeRobot (más ligero)
app.get("/ping", (_req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

// Endpoint bajo /api para compatibilidad
app.get("/api/ping", (_req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

// Test de email endpoint (temporal para debugging)
app.post("/api/test-email", async (req, res) => {
  try {
    const { testEmail } = await import("./lib/testEmailController");
    await testEmail(req, res);
  } catch (error) {
    console.error("Error cargando testEmailController:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// API Routes (comentar si no existen aún)
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/waiter", waiterRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/delivery-orders", deliveryOrdersRoutes); // 🚚 Rutas para órdenes de delivery
app.use("/api/delivery-chat", deliveryChatRoutes); // 💬 Rutas para chat delivery
/*
app.use("/api/users", userRoutes);
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

// Create HTTP server and setup Socket.IO
const httpServer = createServer(app);
const io = setupSocketIO(httpServer);

// Setup delivery chat socket
setupDeliveryChatSocket(io);

// Hacer io accesible para debugging (solo en desarrollo)
if (process.env["NODE_ENV"] !== "production") {
  app.set("socketio", io);
}

// Start server
const server = httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Make io available for other modules
export { io };

// Guardar instancia de io para usar en otros módulos
import { setIOInstance } from "./socket/chatSocket";
setIOInstance(io);

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
