import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const hasConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!hasConfig) {
    return Response.json(
      { status: "degraded", database: "unconfigured", latencyMs: Date.now() - started, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }

  try {
    const { error } = await createPublicClient().rpc("get_public_quote_portal", {
      p_slug: "__healthcheck__",
    });
    const latencyMs = Date.now() - started;

    if (error) {
      return Response.json(
        { status: "degraded", database: "error", latencyMs, timestamp: new Date().toISOString() },
        { status: 503 },
      );
    }

    return Response.json(
      { status: "ok", database: "ok", latencyMs, timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unreachable", latencyMs: Date.now() - started, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
