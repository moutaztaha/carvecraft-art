import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Slider } from "@/components/ui/slider";
import { RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ReliefSettings {
  width: number;
  height: number;
  baseThickness: number;
  reliefDepth: number;
  smoothing: number;
  invertImage: boolean;
}

const DEFAULT_SETTINGS: ReliefSettings = {
  width: 100,
  height: 120,
  baseThickness: 3,
  reliefDepth: 10,
  smoothing: 1,
  invertImage: false,
};

/** Read depth map image into a Float32Array of 0..1 values (grayscale). */
function readDepthPixels(
  img: HTMLImageElement,
  resX: number,
  resY: number,
  smoothPasses: number,
  invert: boolean
): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = resX;
  canvas.height = resY;
  const ctx = canvas.getContext("2d")!;

  // Apply smoothing via blur
  if (smoothPasses > 0) {
    ctx.filter = `blur(${smoothPasses}px)`;
  }
  ctx.drawImage(img, 0, 0, resX, resY);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, resX, resY);
  const data = imageData.data;
  const depths = new Float32Array(resX * resY);

  for (let i = 0; i < depths.length; i++) {
    // Average RGB
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    let val = (r + g + b) / (3 * 255);
    if (invert) val = 1 - val;
    depths[i] = val;
  }

  return depths;
}

/** Build a solid relief mesh geometry: top surface from depth map + sides + bottom base. */
function buildReliefGeometry(
  depths: Float32Array,
  resX: number,
  resY: number,
  physWidth: number,
  physHeight: number,
  baseThickness: number,
  reliefDepth: number
): THREE.BufferGeometry {
  // Top surface vertices
  const topVerts: number[] = [];
  const topNormals: number[] = [];
  const topUvs: number[] = [];
  const topIndices: number[] = [];

  for (let iy = 0; iy < resY; iy++) {
    for (let ix = 0; ix < resX; ix++) {
      const u = ix / (resX - 1);
      const v = iy / (resY - 1);
      const x = (u - 0.5) * physWidth;
      const y = (0.5 - v) * physHeight; // flip Y so top of image is top
      const z = baseThickness + depths[iy * resX + ix] * reliefDepth;

      topVerts.push(x, y, z);
      topUvs.push(u, 1 - v);
      topNormals.push(0, 0, 1); // placeholder, will compute later
    }
  }

  for (let iy = 0; iy < resY - 1; iy++) {
    for (let ix = 0; ix < resX - 1; ix++) {
      const a = iy * resX + ix;
      const b = a + 1;
      const c = a + resX;
      const d = c + 1;
      topIndices.push(a, c, b);
      topIndices.push(b, c, d);
    }
  }

  // Bottom surface (flat)
  const botOffset = resX * resY;
  const botVerts: number[] = [];
  const botNormals: number[] = [];
  const botUvs: number[] = [];
  const botIndices: number[] = [];

  for (let iy = 0; iy < resY; iy++) {
    for (let ix = 0; ix < resX; ix++) {
      const u = ix / (resX - 1);
      const v = iy / (resY - 1);
      const x = (u - 0.5) * physWidth;
      const y = (0.5 - v) * physHeight;
      botVerts.push(x, y, 0);
      botUvs.push(u, 1 - v);
      botNormals.push(0, 0, -1);
    }
  }

  for (let iy = 0; iy < resY - 1; iy++) {
    for (let ix = 0; ix < resX - 1; ix++) {
      const a = botOffset + iy * resX + ix;
      const b = a + 1;
      const c = a + resX;
      const d = c + 1;
      // Winding reversed for bottom face
      botIndices.push(a, b, c);
      botIndices.push(b, d, c);
    }
  }

  // Side walls (4 edges)
  const sideOffset = botOffset + resX * resY;
  const sideVerts: number[] = [];
  const sideNormals: number[] = [];
  const sideUvs: number[] = [];
  const sideIndices: number[] = [];
  let sideIdx = 0;

  const addSideQuad = (
    x0: number, y0: number, zTop0: number,
    x1: number, y1: number, zTop1: number,
    nx: number, ny: number
  ) => {
    const base = sideOffset + sideIdx;
    // top-left, top-right, bot-left, bot-right
    sideVerts.push(x0, y0, zTop0, x1, y1, zTop1, x0, y0, 0, x1, y1, 0);
    sideNormals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0);
    sideUvs.push(0, 1, 1, 1, 0, 0, 1, 0);
    sideIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    sideIdx += 4;
  };

  // Top edge (iy=0)
  for (let ix = 0; ix < resX - 1; ix++) {
    const u0 = ix / (resX - 1), u1 = (ix + 1) / (resX - 1);
    const x0 = (u0 - 0.5) * physWidth, x1 = (u1 - 0.5) * physWidth;
    const y = 0.5 * physHeight;
    const z0 = baseThickness + depths[ix] * reliefDepth;
    const z1 = baseThickness + depths[ix + 1] * reliefDepth;
    addSideQuad(x0, y, z0, x1, y, z1, 0, 1);
  }

  // Bottom edge (iy=resY-1)
  for (let ix = 0; ix < resX - 1; ix++) {
    const row = resY - 1;
    const u0 = ix / (resX - 1), u1 = (ix + 1) / (resX - 1);
    const x0 = (u0 - 0.5) * physWidth, x1 = (u1 - 0.5) * physWidth;
    const y = -0.5 * physHeight;
    const z0 = baseThickness + depths[row * resX + ix] * reliefDepth;
    const z1 = baseThickness + depths[row * resX + ix + 1] * reliefDepth;
    addSideQuad(x1, y, z1, x0, y, z0, 0, -1);
  }

  // Left edge (ix=0)
  for (let iy = 0; iy < resY - 1; iy++) {
    const v0 = iy / (resY - 1), v1 = (iy + 1) / (resY - 1);
    const y0 = (0.5 - v0) * physHeight, y1 = (0.5 - v1) * physHeight;
    const x = -0.5 * physWidth;
    const z0 = baseThickness + depths[iy * resX] * reliefDepth;
    const z1 = baseThickness + depths[(iy + 1) * resX] * reliefDepth;
    addSideQuad(x, y1, z1, x, y0, z0, -1, 0);
  }

  // Right edge (ix=resX-1)
  for (let iy = 0; iy < resY - 1; iy++) {
    const v0 = iy / (resY - 1), v1 = (iy + 1) / (resY - 1);
    const y0 = (0.5 - v0) * physHeight, y1 = (0.5 - v1) * physHeight;
    const x = 0.5 * physWidth;
    const z0 = baseThickness + depths[iy * resX + resX - 1] * reliefDepth;
    const z1 = baseThickness + depths[(iy + 1) * resX + resX - 1] * reliefDepth;
    addSideQuad(x, y0, z0, x, y1, z1, 1, 0);
  }

  // Merge all into one geometry
  const totalVerts = topVerts.length / 3 + botVerts.length / 3 + sideVerts.length / 3;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  let vOff = 0, uOff = 0;
  // Copy top
  positions.set(topVerts, vOff);
  normals.set(topNormals, vOff);
  uvs.set(topUvs, uOff);
  vOff += topVerts.length;
  uOff += topUvs.length;
  // Copy bottom
  positions.set(botVerts, vOff);
  normals.set(botNormals, vOff);
  uvs.set(botUvs, uOff);
  vOff += botVerts.length;
  uOff += botUvs.length;
  // Copy sides
  positions.set(sideVerts, vOff);
  normals.set(sideNormals, vOff);
  uvs.set(sideUvs, uOff);

  const allIndices = [
    ...topIndices,
    ...botIndices,
    ...sideIndices,
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(allIndices);
  geometry.computeVertexNormals();

  return geometry;
}

interface ReliefMeshProps {
  depthMapUrl: string;
  settings: ReliefSettings;
}

const RESOLUTION = 200; // mesh resolution

const ReliefMesh = ({ depthMapUrl, settings }: ReliefMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = depthMapUrl;
  }, [depthMapUrl]);

  const geometry = useMemo(() => {
    if (!image) return null;

    const aspect = image.width / image.height;
    const resX = RESOLUTION;
    const resY = Math.round(RESOLUTION / aspect);

    // Scale to mm - normalize so largest side = settings dimension
    const physW = settings.width;
    const physH = settings.height;

    const depths = readDepthPixels(image, resX, resY, settings.smoothing, settings.invertImage);
    return buildReliefGeometry(depths, resX, resY, physW, physH, settings.baseThickness, settings.reliefDepth);
  }, [image, settings]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color="hsl(30, 40%, 65%)"
        roughness={0.5}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

function AutoFit({ settings }: { settings: ReliefSettings }) {
  const { camera } = useThree();
  useEffect(() => {
    const maxDim = Math.max(settings.width, settings.height, settings.baseThickness + settings.reliefDepth);
    const dist = maxDim * 1.5;
    (camera as THREE.PerspectiveCamera).position.set(dist * 0.4, -dist * 0.6, dist * 0.8);
    camera.lookAt(0, 0, 0);
  }, [settings.width, settings.height, settings.reliefDepth, settings.baseThickness, camera]);
  return null;
}

interface ReliefViewerProps {
  depthMapUrl: string;
}

const ReliefViewer = ({ depthMapUrl }: ReliefViewerProps) => {
  const [settings, setSettings] = useState<ReliefSettings>(DEFAULT_SETTINGS);
  const isModified = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);

  const update = (key: keyof ReliefSettings, value: number | boolean) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const sliders: {
    key: keyof ReliefSettings;
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  }[] = [
    { key: "width", label: "Width", min: 20, max: 300, step: 1, unit: "mm" },
    { key: "height", label: "Height", min: 20, max: 300, step: 1, unit: "mm" },
    { key: "baseThickness", label: "Base Thickness", min: 0.5, max: 20, step: 0.5, unit: "mm" },
    { key: "reliefDepth", label: "Relief Depth", min: 1, max: 30, step: 0.5, unit: "mm" },
    { key: "smoothing", label: "Smoothing", min: 0, max: 10, step: 0.5, unit: "px" },
  ];

  return (
    <div className="space-y-4">
      {/* 3D Canvas */}
      <div className="w-full h-[500px] rounded-lg overflow-hidden border border-border bg-card">
        <Canvas
          camera={{ position: [60, -90, 120], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <color attach="background" args={["hsl(220, 15%, 10%)"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[100, -100, 150]} intensity={1.2} castShadow />
          <directionalLight position={[-80, 60, 80]} intensity={0.4} color="hsl(30, 60%, 80%)" />
          <pointLight position={[0, 0, 120]} intensity={0.5} />
          <ReliefMesh depthMapUrl={depthMapUrl} settings={settings} />
          <AutoFit settings={settings} />
          <OrbitControls
            enableZoom
            enablePan
            minDistance={20}
            maxDistance={500}
          />
        </Canvas>
      </div>

      {/* Controls */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Model Settings
          </h4>
          {isModified && (
            <button
              onClick={() => setSettings(DEFAULT_SETTINGS)}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>

        {sliders.map(({ key, label, min, max, step, unit }) => (
          <div key={key} className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono text-foreground">
                {settings[key] as number}
                {unit}
              </span>
            </div>
            <Slider
              value={[settings[key] as number]}
              onValueChange={([v]) => update(key, v)}
              min={min}
              max={max}
              step={step}
            />
          </div>
        ))}

        {/* Invert toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Label htmlFor="invert" className="text-xs text-muted-foreground">
            Invert Image
          </Label>
          <Switch
            id="invert"
            checked={settings.invertImage}
            onCheckedChange={(v) => update("invertImage", v)}
          />
        </div>
      </div>
    </div>
  );
};

export default ReliefViewer;
