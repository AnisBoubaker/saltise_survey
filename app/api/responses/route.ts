import { NextRequest, NextResponse } from "next/server";
import { ensureParticipant, getSurveyState, upsertResponses } from "@/lib/db";
import { sectionOrder, type SectionId } from "@/lib/survey";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    participantId?: string;
    pseudonym?: string;
    section?: SectionId;
    responses?: Array<{ questionKey: string; value: string | number | null; comment?: string | null }>;
  };

  if (!body.section || !sectionOrder.includes(body.section)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }

  const state = getSurveyState();
  if (body.section !== "context" && (!state.acceptingResponses || state.activeSection !== body.section)) {
    return NextResponse.json({ error: "This section is not currently accepting responses." }, { status: 409 });
  }

  let participant;

  try {
    participant = ensureParticipant({
      participantId: body.participantId,
      pseudonym: body.pseudonym
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "A pseudonym is required." }, { status: 400 });
  }

  upsertResponses(participant.id, body.section, body.responses || []);

  return NextResponse.json({ ok: true, participantId: participant.id });
}
