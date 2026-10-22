import { failureResponse, getFixtures, jsonResponse, resolveDate, resolveSport } from "../../lib/sports";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const date = resolveDate(url.searchParams.get("date"));
  if (typeof date !== "string") {
    return Response.json({ error: date.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const sport = resolveSport(url.searchParams.get("sport"));
  if (typeof sport !== "string") {
    return Response.json({ error: sport.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    return jsonResponse(await getFixtures(date, sport));
  } catch (error) {
    return failureResponse(`fixtures:${date}:${sport}`, error);
  }
}
