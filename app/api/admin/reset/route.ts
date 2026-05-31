import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { resetSurvey } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  resetSurvey();
  return NextResponse.json({ ok: true });
}
