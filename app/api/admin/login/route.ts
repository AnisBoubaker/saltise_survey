import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSurveyState } from "@/lib/db";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  return NextResponse.json({ ok: true, state: getSurveyState() });
}
