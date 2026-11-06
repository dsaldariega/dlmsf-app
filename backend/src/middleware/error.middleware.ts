import type { Request, Response, NextFunction } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const candidate = error as { status?: number; statusCode?: number; message?: string; code?: string; details?: string };
  const status = candidate.status ?? candidate.statusCode ?? (candidate.code === "23505" ? 409 : 500);
  const message = candidate.message || "An unexpected server error occurred.";
  if (status >= 500) console.error("API error:", error);
  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === "production" ? "A server error occurred. Please try again." : message,
    ...(candidate.code ? { code: candidate.code } : {}),
    ...(candidate.details && process.env.NODE_ENV !== "production" ? { details: candidate.details } : {})
  });
}
