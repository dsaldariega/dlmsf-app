
import type {
  Request,
  Response,
  NextFunction
} from "express";

import { createClient } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: "admin" | "member";
      };
      accessToken?: string;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
      return;
    }

    const token = authorization.substring(7);

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } =
      await supabaseAuth.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
      return;
    }

    const role = data.user.app_metadata?.role;

    if (role !== "admin" && role !== "member") {
      res.status(403).json({
        success: false,
        message: "Invalid user role"
      });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role
    };

    req.accessToken = token;

    next();

  } catch (error) {
    console.error("Authentication error:", error);

    res.status(401).json({
      success: false,
      message: "Authentication failed"
    });
  }
}
