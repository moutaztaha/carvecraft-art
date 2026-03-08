import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, quality = "high" } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine image type from base64 header
    let mimeType = "image/png";
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:(image\/[^;]+);base64,/);
      if (match) mimeType = match[1];
    }

    // Strip data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
    const imageUrl = `data:${mimeType};base64,${base64Data}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: quality === "fast" ? "google/gemini-2.5-flash-image" : "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are an expert 3D sculptor and CNC depth map artist. Convert this line art / ornament image into a professional-grade grayscale depth map for CNC bas-relief carving.

CRITICAL REQUIREMENTS for the depth map:
1. PURE GRAYSCALE image — no color, no text, no labels, no watermarks
2. BLACK background (value 0) = the flat base/lowest point
3. WHITE (value 255) = the highest raised point of the relief
4. Use the FULL grayscale range (0-255) with SMOOTH, CONTINUOUS gradients
5. Every ornamental element must have ROUNDED, SCULPTURAL volume — imagine you are sculpting clay
6. Leaves and petals should have smooth convex curvature with soft rollover at edges
7. Curls and scrolls must show overlapping depth — parts in front are brighter than parts behind
8. Create SOFT SHADOWS between overlapping elements using darker grays
9. Edges of ornament elements should have smooth gradient falloff into the background — NO hard/sharp cutoffs
10. Add subtle depth variation WITHIN each element (center slightly higher than edges) to create realistic 3D volume
11. The background around the ornament should smoothly fade to pure black with a gentle vignette
12. Think of this as a height map where every pixel's brightness = its physical height

The result should look like a professional CNC depth map with rich tonal gradients, similar to what a master sculptor would create — smooth, organic, with clear depth layering between overlapping elements. Output ONLY the depth map image.`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to generate depth map" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ error: "No depth map was generated. Please try a different image." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ depthMap: generatedImage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
