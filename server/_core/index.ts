import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { exportTicketsToExcel, exportPurchaseOrdersToExcel, exportTechnicianPerformanceToExcel, exportAuditLogToExcel, exportInventoryToExcel } from "../exportService";
import { generateWorkflowGuidePDF } from "../workflowPdfService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1); // Trust first proxy for accurate rate-limit IP detection
  const server = createServer(app);

  // Security: Helmet for HTTP headers
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Security: Rate limiting
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false, message: { error: "تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً" } });
  app.use("/api/", apiLimiter);

  // Configure body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // File upload endpoint
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
  app.post("/api/upload", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const ext = req.file.originalname.split(".").pop() || "bin";
      const fileKey = `cmms/uploads/${Date.now()}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);
      res.json({ url, fileKey });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // ============================================================
  // EXPORT ENDPOINTS
  // ============================================================
  app.get("/api/export/tickets", async (_req: any, res: any) => {
    try {
      const buffer = await exportTicketsToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=tickets-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/purchase-orders", async (_req: any, res: any) => {
    try {
      const buffer = await exportPurchaseOrdersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=purchase-orders-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/technician-performance", async (req: any, res: any) => {
    try {
      const filters: any = {};
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom);
      if (req.query.dateTo) { const d = new Date(req.query.dateTo); d.setHours(23, 59, 59, 999); filters.dateTo = d; }
      const buffer = await exportTechnicianPerformanceToExcel(Object.keys(filters).length ? filters : undefined);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=technician-performance-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/audit-log", async (req: any, res: any) => {
    try {
      const filters: any = {};
      if (req.query.entityType) filters.entityType = req.query.entityType;
      if (req.query.action) filters.action = req.query.action;
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom);
      if (req.query.dateTo) { const d = new Date(req.query.dateTo); d.setHours(23, 59, 59, 999); filters.dateTo = d; }
      const buffer = await exportAuditLogToExcel(Object.keys(filters).length ? filters : undefined);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=audit-log-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/inventory", async (_req: any, res: any) => {
    try {
      const buffer = await exportInventoryToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=inventory-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Workflow Guide PDF Export
  app.get("/api/export/workflow-guide", async (_req: any, res: any) => {
    try {
      const buffer = await generateWorkflowGuidePDF();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=CMMS-Workflow-Guide-${new Date().toISOString().slice(0, 10)}.pdf`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
