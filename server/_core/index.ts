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
import sharp from "sharp";
import { exportTicketsToExcel, exportPurchaseOrdersToExcel, exportTechnicianPerformanceToExcel, exportAuditLogToExcel, exportInventoryToExcel, exportPreventivePlansToExcel, exportPMWorkOrdersToExcel } from "../exportService";
import { generateWorkflowGuidePDF } from "../workflowPdfService";
import { runTechnicianOverdueJob } from "../jobs/technician-overdue";
import { runPMAutomationJob } from "../jobs/pm-automation";
import { sdk } from "./sdk";

// ============================================================
// AUTH MIDDLEWARE — C-01 & C-02 FIX
// Restricts access to export/upload endpoints to authenticated users only
// Allowed roles: owner, admin, maintenance_manager, supervisor, senior_management, accounting
// ============================================================
const EXPORT_ALLOWED_ROLES = new Set([
  "owner", "admin", "maintenance_manager", "supervisor", "senior_management", "accounting"
]);

async function requireAuthMiddleware(req: any, res: any, next: any) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: "غير مصرح — يجب تسجيل الدخول أولاً" });
    }
    req.authenticatedUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "غير مصرح — يجب تسجيل الدخول أولاً" });
  }
}

async function requireExportRole(req: any, res: any, next: any) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: "غير مصرح — يجب تسجيل الدخول أولاً" });
    }
    if (!EXPORT_ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({ error: "ليس لديك صلاحية تصدير البيانات" });
    }
    req.authenticatedUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "غير مصرح — يجب تسجيل الدخول أولاً" });
  }
}

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
  app.set('trust proxy', 1);
  const server = createServer(app);

  // ============================================================
  // H-02 FIX: تفعيل Content Security Policy في Helmet
  // ============================================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        mediaSrc: ["'self'", "blob:", "https:"],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ============================================================
  // M-01 FIX: Rate Limiting محسّن يشمل /api/trpc
  // ============================================================
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً" },
  
  });

  // Rate limiter أكثر صرامة للـ auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة" },
  });

  app.use("/api/", apiLimiter);
  app.use("/api/oauth/", authLimiter);

  // ============================================================
  // H-03 FIX: تقليل Body Parser limit إلى 1MB لمنع هجمات DoS
  // (رفع الملفات يمر عبر multer وليس body parser)
  // ============================================================
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // ============================================================
  // C-02 FIX: تأمين Upload endpoint بمصادقة إلزامية
  // ============================================================
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      // L-02 FIX: التحقق من نوع الملف بالـ mimetype
      const ALLOWED_MIME_TYPES = new Set([
        "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ]);
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`نوع الملف غير مسموح: ${file.mimetype}`));
      }
    },
  });

  app.post("/api/upload", requireAuthMiddleware, upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const isImage = req.file.mimetype.startsWith("image/");
      let fileBuffer = req.file.buffer;
      let mimeType = req.file.mimetype;
      let ext = req.file.originalname.split(".").pop() || "bin";

      // تحويل الصور إلى WebP مع تقليص الأبعاد لتسريع الرفع
      if (isImage) {
        fileBuffer = await sharp(req.file.buffer)
          .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75, effort: 2 })
          .toBuffer();
        mimeType = "image/webp";
        ext = "webp";
      }
      const fileKey = `cmms/uploads/${Date.now()}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, mimeType);
      res.json({ url, fileKey });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // ============================================================
  // C-01 FIX: تأمين جميع Export endpoints بمصادقة + صلاحية
  // ============================================================
  app.get("/api/export/tickets", requireExportRole, async (_req: any, res: any) => {
    try {
      const buffer = await exportTicketsToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=tickets-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/purchase-orders", requireExportRole, async (_req: any, res: any) => {
    try {
      const buffer = await exportPurchaseOrdersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=purchase-orders-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/technician-performance", requireExportRole, async (req: any, res: any) => {
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

  app.get("/api/export/audit-log", requireExportRole, async (req: any, res: any) => {
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

  app.get("/api/export/inventory", requireExportRole, async (_req: any, res: any) => {
    try {
      const buffer = await exportInventoryToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=inventory-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/preventive-plans", requireExportRole, async (_req: any, res: any) => {
    try {
      const buffer = await exportPreventivePlansToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=preventive-plans-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/pm-work-orders", requireExportRole, async (_req: any, res: any) => {
    try {
      const buffer = await exportPMWorkOrdersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=pm-work-orders-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/export/workflow-guide", requireExportRole, async (_req: any, res: any) => {
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

  const ONE_HOUR = 60 * 60 * 1000;
  setTimeout(() => {
    runTechnicianOverdueJob();
    setInterval(runTechnicianOverdueJob, ONE_HOUR);
  }, 5000);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    runPMAutomationJob();
    setInterval(runPMAutomationJob, SIX_HOURS);
  }, 10000);
}

startServer().catch(console.error);
