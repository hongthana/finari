import { jsonError } from "@/lib/api";
import { searchCompanies } from "@/lib/sec";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await searchCompanies(query);
    return Response.json({ results });
  } catch {
    return jsonError("Unable to search SEC ticker directory right now", 502);
  }
}
