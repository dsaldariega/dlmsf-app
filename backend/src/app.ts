import express from "express";
import cors from "cors";
import helmet from "helmet";
import memberRoutes from "./routes/member.routes.js";
import loanRoutes from "./routes/loan.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

const app = express();
app.use(helmet());

const allowedOrigins = new Set([
  "https://dlmsf-app.vercel.app",
  ...(process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Requests without an Origin header are server-to-server or local health checks.
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Explicitly handle preflight before route matching in Vercel's catch-all function.
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", message: "DLMSF API is running" } });
});

app.use("/api/members", memberRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit", auditRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
