"""
ReliefForge Local Bridge Server
================================
A Python FastAPI server that mimics the Supabase edge function API,
routing depth map generation to a local ComfyUI instance.

Requirements:
  pip install fastapi uvicorn httpx pillow

Usage:
  python bridge_server.py
  # Server runs on http://localhost:8000

Then in ReliefForge settings, set mode to "Local GPU" 
and endpoint to http://localhost:8000

This script accepts the SAME request format as the cloud edge function:
  POST /generate-depth-map
  Body: { "imageBase64": "data:image/png;base64,...", "quality": "high" }
  Response: { "depthMap": "data:image/png;base64,..." }
"""

import asyncio
import base64
import io
import json
import time
import uuid
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Configuration ───────────────────────────────────────────────
COMFYUI_URL = "http://127.0.0.1:8188"
WORKFLOW_PATH = Path(__file__).parent / "comfyui-depth-workflow.json"
POLL_INTERVAL = 1.0  # seconds
MAX_WAIT = 180  # seconds

app = FastAPI(title="ReliefForge Local Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    imageBase64: str
    quality: str = "high"


def load_workflow() -> dict:
    """Load the ComfyUI workflow JSON."""
    if WORKFLOW_PATH.exists():
        with open(WORKFLOW_PATH) as f:
            return json.load(f)
    # Fallback minimal workflow
    return {
        "1": {
            "class_type": "LoadImage",
            "inputs": {"image": "input.png"},
        },
        "2": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "depth_output",
                "images": ["1", 0],
            },
        },
    }


async def upload_image(client: httpx.AsyncClient, image_b64: str) -> str:
    """Upload a base64 image to ComfyUI and return the filename."""
    # Strip data URL prefix
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    image_bytes = base64.b64decode(image_b64)
    filename = f"reliefforge_input_{uuid.uuid4().hex[:8]}.png"

    resp = await client.post(
        f"{COMFYUI_URL}/upload/image",
        files={"image": (filename, io.BytesIO(image_bytes), "image/png")},
        data={"overwrite": "true"},
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("name", filename)


async def queue_prompt(client: httpx.AsyncClient, workflow: dict) -> str:
    """Queue a workflow prompt and return the prompt_id."""
    resp = await client.post(
        f"{COMFYUI_URL}/api/prompt",
        json={"prompt": workflow},
    )
    resp.raise_for_status()
    return resp.json()["prompt_id"]


async def poll_result(client: httpx.AsyncClient, prompt_id: str) -> str:
    """Poll ComfyUI history until the result image is ready, return as data URL."""
    start = time.time()
    while time.time() - start < MAX_WAIT:
        resp = await client.get(f"{COMFYUI_URL}/api/history/{prompt_id}")
        if resp.status_code == 200:
            history = resp.json()
            entry = history.get(prompt_id)
            if entry and entry.get("outputs"):
                for node_id, output in entry["outputs"].items():
                    images = output.get("images", [])
                    if images:
                        img = images[0]
                        subfolder = img.get("subfolder", "")
                        img_type = img.get("type", "output")
                        img_resp = await client.get(
                            f"{COMFYUI_URL}/view",
                            params={
                                "filename": img["filename"],
                                "subfolder": subfolder,
                                "type": img_type,
                            },
                        )
                        img_resp.raise_for_status()
                        b64 = base64.b64encode(img_resp.content).decode()
                        return f"data:image/png;base64,{b64}"
        await asyncio.sleep(POLL_INTERVAL)

    raise TimeoutError("ComfyUI did not return a result within the timeout")


@app.get("/")
async def health():
    return {"status": "ok", "service": "ReliefForge Local Bridge"}


@app.post("/generate-depth-map")
async def generate_depth_map(req: GenerateRequest):
    """
    Drop-in replacement for the cloud edge function.
    Accepts the same JSON body and returns the same response format.
    """
    try:
        async with httpx.AsyncClient(timeout=200) as client:
            # 1. Check ComfyUI is running
            try:
                await client.get(f"{COMFYUI_URL}/api/system_stats")
            except httpx.ConnectError:
                raise HTTPException(
                    status_code=503,
                    detail=f"Cannot connect to ComfyUI at {COMFYUI_URL}. Is it running?",
                )

            # 2. Upload image
            filename = await upload_image(client, req.imageBase64)

            # 3. Prepare workflow
            workflow = load_workflow()
            # Inject the uploaded filename into the LoadImage node
            for node_id, node in workflow.items():
                if node.get("class_type") == "LoadImage":
                    node["inputs"]["image"] = filename
                    break

            # 4. Queue and poll
            prompt_id = await queue_prompt(client, workflow)
            result_b64 = await poll_result(client, prompt_id)

            return {"depthMap": result_b64}

    except HTTPException:
        raise
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("  ReliefForge Local Bridge Server")
    print(f"  ComfyUI endpoint: {COMFYUI_URL}")
    print(f"  Workflow file: {WORKFLOW_PATH}")
    print("  API: POST http://localhost:8000/generate-depth-map")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
