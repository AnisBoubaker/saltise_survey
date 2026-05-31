import { NextRequest } from "next/server";

export function requireAdmin(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, error: "ADMIN_PASSWORD is not configured." };
  }

  const headerPassword = request.headers.get("x-admin-password");
  if (headerPassword !== expected) {
    return { ok: false, error: "Invalid admin password." };
  }

  return { ok: true, error: null };
}

export function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
