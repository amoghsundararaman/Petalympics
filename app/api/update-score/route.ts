import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId, stats } = await req.json();

  const score =
    stats.Health * 1.2 +
    stats.Strength * 1.1 +
    stats.Agility * 1.1 +
    stats.Intellect * 1.3 +
    stats.Creativity * 1.3 +
    stats.Accuracy * 1.2;

  // Save to DB (supabase client here)

  return NextResponse.json({ score: Math.floor(score * 10) });
}
