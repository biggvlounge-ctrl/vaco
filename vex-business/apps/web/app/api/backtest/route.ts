import { NextRequest, NextResponse } from "next/server";

// Vex Business — a real, same-origin proxy to the real FastAPI backend's own
// POST /api/backtest/run. Same real reasoning as app/api/pipeline/route.ts:
// keeps VEXBUSINESS_API_URL server-side-only and avoids CORS entirely.

export async function POST(request: NextRequest) {
  const apiUrl = process.env.VEXBUSINESS_API_URL ?? "http://localhost:9000";
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/api/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Could not reach the Vex Business API: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
