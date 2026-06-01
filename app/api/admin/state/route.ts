import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSurveyState, setSurveyState } from "@/lib/db";
import { sectionOrder, type SectionId } from "@/lib/survey";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  return NextResponse.json(getSurveyState());
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const body = (await request.json()) as { activeSection?: SectionId | null; acceptingResponses?: boolean };
  const activeSection = body.activeSection || null;

  if (activeSection && !sectionOrder.includes(activeSection)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }

  return NextResponse.json(setSurveyState(activeSection, Boolean(body.acceptingResponses)));
}
