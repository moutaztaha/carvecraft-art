import { motion } from "framer-motion";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEffect, useRef, useState, useCallback } from "react";

interface DepthMapDisplayProps {
  depthMapUrl: string;
  onProcessedUrlChange?: (url: string) => void;
}

interface Adjustments {
  brightness: number;
  contrast: number;
  blur: number;
  depthIntensity: number;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  blur: 0,
  depthIntensity: 100,
};

const DepthMapDisplay = ({ depthMapUrl, onProcessedUrlChange }: DepthMapDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [processedUrl, setProcessedUrl] = useState<string>(depthMapUrl);

  // Load source image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      sourceImageRef.current = img;
      applyAdjustments();
    };
    img.src = depthMapUrl;
  }, [depthMapUrl]);

  const applyAdjustments = useCallback(() => {
    const img = sourceImageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.width;
    canvas.height = img.height;

    // Apply blur via CSS filter on canvas
    ctx.filter = adjustments.blur > 0 ? `blur(${adjustments.blur}px)` : "none";
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const brightnessOffset = adjustments.brightness * 2.55; // -100..100 -> -255..255
    const contrastFactor =
      (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
    const intensityScale = adjustments.depthIntensity / 100;

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let val = data[i + c];

        // Depth intensity (scale toward mid-gray)
        val = 128 + (val - 128) * intensityScale;

        // Contrast
        val = contrastFactor * (val - 128) + 128;

        // Brightness
        val += brightnessOffset;

        data[i + c] = Math.max(0, Math.min(255, val));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const url = canvas.toDataURL("image/png");
    setProcessedUrl(url);
    onProcessedUrlChange?.(url);
  }, [adjustments]);

  useEffect(() => {
    if (sourceImageRef.current) {
      applyAdjustments();
    }
  }, [adjustments, applyAdjustments]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = processedUrl;
    link.download = "depth-map.png";
    link.click();
  };

  const handleReset = () => setAdjustments(DEFAULT_ADJUSTMENTS);

  const updateAdjustment = (key: keyof Adjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  };

  const sliders: { key: keyof Adjustments; label: string; min: number; max: number; step: number; unit: string }[] = [
    { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1, unit: "" },
    { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1, unit: "" },
    { key: "blur", label: "Smoothing", min: 0, max: 10, step: 0.5, unit: "px" },
    { key: "depthIntensity", label: "Depth Intensity", min: 0, max: 200, step: 1, unit: "%" },
  ];

  const isModified = JSON.stringify(adjustments) !== JSON.stringify(DEFAULT_ADJUSTMENTS);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Depth Map Image */}
        <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card">
          <img src={processedUrl} alt="Generated depth map" className="w-full h-auto max-h-[500px] object-contain p-4" />
        </div>

        {/* Adjustment Controls */}
        <div className="lg:w-64 shrink-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Adjustments</h4>
              {isModified && (
                <button onClick={handleReset} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {sliders.map(({ key, label, min, max, step, unit }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-foreground">
                    {adjustments[key]}
                    {unit}
                  </span>
                </div>
                <Slider
                  value={[adjustments[key]]}
                  onValueChange={([v]) => updateAdjustment(key, v)}
                  min={min}
                  max={max}
                  step={step}
                />
              </div>
            ))}
          </div>

          <Button onClick={handleDownload} variant="hero" size="lg" className="w-full">
            <Download className="w-5 h-5 mr-2" />
            Download Depth Map
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default DepthMapDisplay;
