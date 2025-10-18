// app/api/system/route.ts
import { getSystemDetails } from "@/app/lib/system";

export const dynamic = "force-dynamic"; // ensure no static caching

export async function GET() {
  const data = await getSystemDetails();
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}