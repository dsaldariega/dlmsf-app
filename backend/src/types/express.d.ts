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