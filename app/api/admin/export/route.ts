import { NextRequest, NextResponse } from "next/server";
import { csvEscape, requireAdmin } from "@/lib/admin";
import { getCsvRows } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const rows = getCsvRows();
  const headers = [
    "participant_id",
    "has_pseudonym",
    "participant_created_at",
    "section",
    "question_key",
    "value",
    "comment",
    "created_at",
    "updated_at"
  ];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="genai-survey-export-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
