import { NextRequest } from "next/server";

export function requireAdmin(req: NextRequest): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new AdminError("ADMIN_SECRET is not configured", 503);
  }
  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header || header !== secret) {
    throw new AdminError("Unauthorized", 401);
  }
}

export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AdminError";
    this.status = status;
  }
}
