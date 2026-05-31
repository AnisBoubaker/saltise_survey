import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getDashboardData());
}
