import { NextRequest, NextResponse } from "next/server";
import { ensureParticipant, getParticipantResponses } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { participantId?: string; pseudonym?: string };
  let participant;

  try {
    participant = ensureParticipant({
      participantId: body.participantId,
      pseudonym: body.pseudonym
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "A pseudonym is required." }, { status: 400 });
  }

  return NextResponse.json({
    participantId: participant.id,
    pseudonymLinked: participant.pseudonymLinked,
    responses: getParticipantResponses(participant.id)
  });
}
