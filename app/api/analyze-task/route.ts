import { NextResponse } from "next/server";

const ALLOWED_STATS = [
  "Health",
  "Agility",
  "Strength",
  "Intellect",
  "Creativity",
  "Accuracy",
];

export async function POST(req: Request) {
  const { taskText, timeSpent } = await req.json();

  if (!taskText || !timeSpent) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const prompt = `
You are a deterministic RPG rules engine.
You are NOT a creative assistant.

Your task is to analyze a real-world activity and assign:
1) Stat relevance
2) Point value
3) Confidence score

You must be precise and conservative.

=====================
STAT SELECTION RULES
=====================

Health is NOT a default stat.

Health SHOULD be awarded when the task directly improves:
- Cardiovascular endurance
- Physical stamina
- Recovery, mobility, or bodily well-being

Examples where Health IS correct:
- Walking, jogging, workouts, yoga, stretching
- Sports involving sustained movement
- Physical routines done for health maintenance

Do NOT award Health for:
- Mental effort
- Creative work
- Short incidental movement

Agility is awarded if:
- The task involves coordination, balance, speed, or controlled movement
- Examples: sports, dance, yoga flows, skill-based physical movement

Strength is awarded if:
- The task involves muscular force or resistance
- Examples: lifting, strength training, bodyweight workouts

Accuracy is awarded if:
- The task requires precision, correctness, or low error tolerance
- Examples: debugging, editing, QA, alignment, careful planning

Intellect is awarded if:
- The task involves reasoning, learning, problem-solving, or analysis
- Examples: studying, coding, research, planning

Creativity is awarded if:
- The task involves ideation or expressive output
- Examples: painting, designing, writing, composing

IMPORTANT BALANCE RULES:
- If a task involves careful execution, Accuracy MUST be included
- If a task involves coordinated movement, Agility MUST be included
- Do NOT collapse all mental effort into Intellect
- Include ALL relevant stats, but avoid unnecessary ones

=====================
POINT RULES
=====================

Points represent effort AND focus quality.

Baseline:
- Low effort / short task → 1 point
- Moderate effort OR strong focus → 2 points
- Sustained effort AND strong focus → 3 points

Time is a hard constraint:
- ≤30 minutes → max 1 point
- ≤90 minutes → max 2 points
- 91+ minutes → max 3 points

=====================
CONFIDENCE SCORING
=====================

Return a confidence score between 0.0 and 1.0.

High confidence:
- Clear task description
- Clear stat mapping

Low confidence:
- Vague wording
- Ambiguous effort or intent

=====================
FORBIDDEN BEHAVIOR
=====================

- Do NOT invent stats
- Do NOT assign physical stats to mental-only tasks
- Do NOT assign Creativity to exercise
- Do NOT exceed point caps
- Do NOT add explanations

=====================
INPUT
=====================
Task description:
${taskText}

Time spent:
${timeSpent} minutes

=====================
OUTPUT
=====================
Return ONLY valid JSON:
{
  "points": number,
  "eligibleStats": ["StatName","StatName"],
  "confidence": number
}
`;

  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama2",
        prompt,
        stream: false,
      }),
    });

    const data = await response.json();

    const raw = data.response?.trim();
    const jsonStart = raw?.indexOf("{");
    const jsonEnd = raw?.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Invalid JSON from LLM");
    }

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    /* -----------------------------
       SAFETY & BALANCE CLAMPS
    ----------------------------- */

    // Hard cap points by time
    const maxPoints =
      timeSpent <= 30 ? 1 : timeSpent <= 90 ? 2 : 3;

    parsed.points = Math.min(
      Math.max(parsed.points ?? 1, 1),
      maxPoints
    );

    // Confidence-based penalty
    if (typeof parsed.confidence === "number" && parsed.confidence < 0.4) {
      parsed.points = Math.max(1, parsed.points - 1);
    }

    // Stat whitelist enforcement
    if (Array.isArray(parsed.eligibleStats)) {
      parsed.eligibleStats = parsed.eligibleStats.filter((s: string) =>
        ALLOWED_STATS.includes(s)
      );
    }

    // Cap stats to max 2 (prevents stat soup)
    if (parsed.eligibleStats.length > 2) {
      parsed.eligibleStats = parsed.eligibleStats.slice(0, 2);
    }

    // Absolute fallback
    if (!parsed.eligibleStats || parsed.eligibleStats.length === 0) {
      parsed.eligibleStats = ["Intellect"];
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("LLM processing failed:", err);
    return NextResponse.json(
      { error: "LLM processing failed" },
      { status: 500 }
    );
  }
}
