
import type { Request, Response, NextFunction } from "express";

type UserRole = "admin" | "member";

export function authorize(...allowedRoles: UserRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action"
      });
      return;
    }

    next();
  };
}
