import { failureResponse, getLive, jsonResponse, resolveSport } from "../../lib/sports";

export async function GET(request: Request): Promise<Response> {
  const sport = resolveSport(new URL(request.url).searchParams.get("sport"));
  if (typeof sport !== "string") {
    return Response.json({ error: sport.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    return jsonResponse(await getLive(sport));
  } catch (error) {
    return failureResponse(`live:${sport}`, error);
  }
}
