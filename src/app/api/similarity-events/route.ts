import { NextResponse } from "next/server";

const FLASK_BASE_URL = process.env.FLASK_BASE_URL || "http://localhost:5000";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const res = await fetch(`${FLASK_BASE_URL}/similarity/events-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: "flask_error", detail: error },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_proxy", detail: `${error}` },
      { status: 500 }
    );
  }
}
