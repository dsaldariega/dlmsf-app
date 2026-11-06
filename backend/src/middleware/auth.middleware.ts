
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

    // Use the authenticated user's token for both Auth and the members query.
    // The application's source of truth for roles is public.members.roles,
    // not auth.users.app_metadata.role.
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
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

    const { data: member, error: memberError } = await supabaseAuth
      .from("members")
      .select("roles")
      .eq("auth_id", data.user.id)
      .maybeSingle();

    if (memberError) {
      console.error("Unable to load user role:", memberError);

      res.status(403).json({
        success: false,
        message: "Unable to verify user role"
      });
      return;
    }

    if (!member) {
      res.status(403).json({
        success: false,
        message: "User profile not found"
      });
      return;
    }

    const rawRoles = member.roles;
    const roles =
      typeof rawRoles === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(rawRoles);
              return Array.isArray(parsed) ? parsed : [rawRoles];
            } catch {
              return [rawRoles];
            }
          })()
        : Array.isArray(rawRoles)
          ? rawRoles
          : [rawRoles];

    const normalizedRoles = roles
      .filter((role): role is string => typeof role === "string")
      .map((role) => role.trim().toLowerCase());

    const role =
      normalizedRoles.includes("admin")
        ? "admin"
        : normalizedRoles.includes("member")
          ? "member"
          : null;

    if (!role) {
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
