import { getApiConfig } from "@/components/ApiSettings";

/**
 * Generates a depth map using the local bridge server.
 * The bridge server accepts the exact same API format as the cloud edge function:
 *   POST /generate-depth-map { imageBase64, quality } → { depthMap }
 */
export async function generateDepthMapLocal(
  imageBase64: string,
  quality: "fast" | "high"
): Promise<string> {
  const config = getApiConfig();
  const endpoint = config.localEndpoint.replace(/\/$/, "");

  const resp = await fetch(`${endpoint}/generate-depth-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, quality }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
    throw new Error(errData.detail || errData.error || `Local API error: ${resp.status}`);
  }

  const data = await resp.json();
  if (!data.depthMap) {
    throw new Error("No depth map returned from local server");
  }

  return data.depthMap;
}
