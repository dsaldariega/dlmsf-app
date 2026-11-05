import express from "express";
import cors from "cors";
import helmet from "helmet";
import memberRoutes from "./routes/member.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "DLMSF API is running",
  });
});

app.use("/api/members", memberRoutes);

export default app;