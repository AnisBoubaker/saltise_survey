import { NextResponse } from "next/server";
import { getSurveyState } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getSurveyState());
}
