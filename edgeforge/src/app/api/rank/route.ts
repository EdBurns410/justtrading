import { NextResponse } from "next/server";
import type { IntakeAnswers } from "@/lib/types";
import { rank } from "@/lib/ranking";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: IntakeAnswers;
  try {
    body = (await req.json()) as IntakeAnswers;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing intake body" }, { status: 400 });
  }
  if (typeof body.fullyLoadedHourlyCost !== "number" || body.fullyLoadedHourlyCost <= 0) {
    return NextResponse.json({ error: "fullyLoadedHourlyCost must be > 0" }, { status: 400 });
  }
  if (!body.workflowHours || typeof body.workflowHours !== "object") {
    return NextResponse.json({ error: "workflowHours required" }, { status: 400 });
  }

  const result = rank(body);

  if (result.rankedOpportunities.length === 0) {
    return NextResponse.json(
      { error: "No workflows with hours > 0. Add at least one." },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
