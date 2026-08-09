import { NextRequest, NextResponse } from "next/server";

const CREATOMATE_API = "https://api.creatomate.com/v1/renders";

/* Best-effort per-instance rate limit: 5 renders per IP per 10 min */
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= 5) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

/* BiLabs-branded 6.5s square promo, text injected from the form */
function buildSource(brand: string, message: string) {
  return {
    output_format: "mp4",
    width: 720,
    height: 720,
    duration: 6.5,
    fill_color: "#050507",
    elements: [
      {
        type: "text",
        text: "BILABS · AI VIDEO DEMO",
        y: "8%",
        width: "80%",
        font_family: "Roboto Mono",
        font_size: "3 vmin",
        letter_spacing: "18%",
        fill_color: "rgba(245,183,49,0.65)",
        x_alignment: "50%",
      },
      {
        type: "text",
        text: brand,
        time: 0.3,
        duration: 2.1,
        y: "48%",
        width: "84%",
        font_family: "Poppins",
        font_weight: "700",
        font_size: "11 vmin",
        fill_color: "#F5B731",
        x_alignment: "50%",
        y_alignment: "50%",
        animations: [
          { time: "start", duration: 0.7, type: "text-slide", direction: "up", split: "word" },
          { time: "end", duration: 0.4, type: "fade", reversed: true },
        ],
      },
      {
        type: "text",
        text: message,
        time: 2.4,
        duration: 2.2,
        y: "48%",
        width: "80%",
        font_family: "Poppins",
        font_weight: "500",
        font_size: "6.5 vmin",
        fill_color: "#FFFFFF",
        x_alignment: "50%",
        y_alignment: "50%",
        animations: [
          { time: "start", duration: 0.6, type: "text-slide", direction: "up", split: "line" },
          { time: "end", duration: 0.4, type: "fade", reversed: true },
        ],
      },
      {
        type: "text",
        text: "AI that does the work for you.",
        time: 4.6,
        duration: 1.9,
        y: "44%",
        width: "80%",
        font_family: "Poppins",
        font_weight: "700",
        font_size: "7 vmin",
        fill_color: "#FFFFFF",
        x_alignment: "50%",
        y_alignment: "50%",
        animations: [{ time: "start", duration: 0.5, type: "text-slide", direction: "up", split: "word" }],
      },
      {
        type: "text",
        text: "bilabs.ai",
        time: 4.6,
        duration: 1.9,
        y: "58%",
        width: "80%",
        font_family: "Roboto Mono",
        font_size: "4 vmin",
        letter_spacing: "10%",
        fill_color: "#F5B731",
        x_alignment: "50%",
        animations: [{ time: "start", duration: 0.6, type: "fade" }],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Video service not configured" }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many videos from this connection — try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: { brand?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const brand = (body.brand ?? "").trim().slice(0, 40);
  const message = (body.message ?? "").trim().slice(0, 120);
  if (!brand || !message) {
    return NextResponse.json({ error: "Both fields are required" }, { status: 400 });
  }

  const res = await fetch(CREATOMATE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: buildSource(brand, message) }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Creatomate render failed:", res.status, detail);
    return NextResponse.json({ error: "Video render failed to start" }, { status: 502 });
  }

  const renders = await res.json();
  const id = Array.isArray(renders) ? renders[0]?.id : renders?.id;
  if (!id) {
    return NextResponse.json({ error: "Video render failed to start" }, { status: 502 });
  }
  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Video service not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid render id" }, { status: 400 });
  }

  const res = await fetch(`${CREATOMATE_API}/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Status check failed" }, { status: 502 });
  }

  const render = await res.json();
  return NextResponse.json({ status: render.status, url: render.url ?? null });
}
