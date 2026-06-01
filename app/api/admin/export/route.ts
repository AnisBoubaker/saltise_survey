import { NextRequest, NextResponse } from "next/server";
import { csvEscape, requireAdmin } from "@/lib/admin";
import { getCsvRows } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const collectionIdParam = request.nextUrl.searchParams.get("collectionId");
  let collectionId: number | undefined;
  if (collectionIdParam) {
    const parsedCollectionId = Number(collectionIdParam);
    if (!Number.isInteger(parsedCollectionId) || parsedCollectionId < 1) {
      return NextResponse.json({ error: "Invalid collection ID." }, { status: 400 });
    }
    collectionId = parsedCollectionId;
  }

  const rows = getCsvRows(collectionId);
  const headers = [
    "collection_id",
    "collection_name",
    "collection_created_at",
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
      "content-disposition": `attachment; filename="genai-survey-${collectionId ? `collection-${collectionId}` : "all"}-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
