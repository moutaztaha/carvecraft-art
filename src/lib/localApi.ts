import { getApiConfig } from "@/components/ApiSettings";

/**
 * Calls a local ComfyUI instance to generate a depth map.
 * 
 * This sends the image to ComfyUI's /api/prompt endpoint.
 * The user needs to have a workflow loaded that:
 * 1. Accepts an input image
 * 2. Processes it through a depth estimation model (e.g., Marigold, DepthAnything)
 * 3. Returns the depth map image
 * 
 * For simplicity, we use the /upload/image + /api/prompt + polling pattern.
 */
export async function generateDepthMapLocal(
  imageBase64: string,
  quality: "fast" | "high"
): Promise<string> {
  const config = getApiConfig();
  const endpoint = config.localEndpoint.replace(/\/$/, "");

  // Step 1: Upload the source image to ComfyUI
  const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const blob = new Blob([bytes], { type: "image/png" });
  const formData = new FormData();
  formData.append("image", blob, "input.png");
  formData.append("overwrite", "true");

  const uploadResp = await fetch(`${endpoint}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!uploadResp.ok) {
    throw new Error(`ComfyUI upload failed (${uploadResp.status}). Is ComfyUI running at ${endpoint}?`);
  }

  const uploadData = await uploadResp.json();
  const filename = uploadData.name;

  // Step 2: Queue a prompt using the uploaded image
  // This is a minimal workflow — user should customize via ComfyUI UI
  const workflow = createDepthWorkflow(filename, quality);

  const promptResp = await fetch(`${endpoint}/api/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!promptResp.ok) {
    throw new Error(`ComfyUI prompt failed (${promptResp.status}). Check your workflow.`);
  }

  const { prompt_id } = await promptResp.json();

  // Step 3: Poll for completion
  const result = await pollForResult(endpoint, prompt_id);
  return result;
}

async function pollForResult(endpoint: string, promptId: string): Promise<string> {
  const maxWait = 120000; // 2 minutes
  const interval = 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const resp = await fetch(`${endpoint}/api/history/${promptId}`);
    if (resp.ok) {
      const history = await resp.json();
      const entry = history[promptId];
      if (entry?.outputs) {
        // Find the first image output
        for (const nodeId of Object.keys(entry.outputs)) {
          const output = entry.outputs[nodeId];
          if (output.images && output.images.length > 0) {
            const img = output.images[0];
            const imageUrl = `${endpoint}/view?filename=${img.filename}&subfolder=${img.subfolder || ""}&type=${img.type || "output"}`;
            
            // Fetch and convert to base64
            const imgResp = await fetch(imageUrl);
            const imgBlob = await imgResp.blob();
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(imgBlob);
            });
          }
        }
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("ComfyUI generation timed out after 2 minutes");
}

function createDepthWorkflow(inputFilename: string, quality: "fast" | "high") {
  // Minimal ComfyUI workflow for depth map generation
  // Users should replace this with their own workflow via ComfyUI UI
  // This is a basic LoadImage → SaveImage template
  return {
    "1": {
      class_type: "LoadImage",
      inputs: {
        image: inputFilename,
      },
    },
    "2": {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: "depth_output",
        images: ["1", 0],
      },
    },
  };
}
