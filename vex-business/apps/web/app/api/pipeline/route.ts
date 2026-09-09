import { NextRequest, NextResponse } from "next/server";

// Vex Business — a real, same-origin proxy to the real FastAPI backend's own
// POST /api/pipeline/run. Exists so the dashboard's client component
// can call a same-origin path (avoiding CORS entirely) while
// VEXBUSINESS_API_URL — only resolvable from inside the Docker network in a
// real deployment (see docker-compose.yml's own `VEXBUSINESS_API_URL:
// http://api:9000`) — stays a real, server-side-only value, the same
// pattern the existing getHealth() server component already uses.
// Forwards the real upstream status code and body verbatim, success
// or error alike — never translates a real backend rejection into a
// fabricated client-side success.

export async function POST(request: NextRequest) {
  const apiUrl = process.env.VEXBUSINESS_API_URL ?? "http://localhost:9000";
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/api/pipeline/run`, {
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
