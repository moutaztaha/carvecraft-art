import { useState, useEffect } from "react";
import { Settings, Cloud, Monitor, X, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type ApiMode = "cloud" | "local";

export interface ApiConfig {
  mode: ApiMode;
  localEndpoint: string;
}

const STORAGE_KEY = "reliefforge-api-config";

const defaultConfig: ApiConfig = {
  mode: "cloud",
  localEndpoint: "http://localhost:8000",
};

export function getApiConfig(): ApiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultConfig, ...JSON.parse(stored) };
  } catch {}
  return defaultConfig;
}

function saveApiConfig(config: ApiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function ApiSettings() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ApiConfig>(getApiConfig);

  useEffect(() => {
    saveApiConfig(config);
  }, [config]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
        title="API Settings"
      >
        <Settings className="w-5 h-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">API Settings</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Mode Toggle */}
            <div className="space-y-4">
              <Label className="text-sm text-muted-foreground">Generation Backend</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfig((c) => ({ ...c, mode: "cloud" }))}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    config.mode === "cloud"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  Cloud AI
                </button>
                <button
                  onClick={() => setConfig((c) => ({ ...c, mode: "local" }))}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    config.mode === "local"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  Local GPU
                </button>
              </div>
            </div>

            {config.mode === "cloud" && (
              <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg">
                Uses Lovable Cloud AI (Gemini) — no setup needed. Best quality depth maps.
              </p>
            )}

            {config.mode === "local" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint" className="text-sm text-muted-foreground">
                    Bridge Server Endpoint
                  </Label>
                  <Input
                    id="endpoint"
                    value={config.localEndpoint}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, localEndpoint: e.target.value }))
                    }
                    placeholder="http://localhost:8000"
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg">
                  Runs depth maps on your local GPU via ComfyUI + Python bridge. No internet needed.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-primary"
                  onClick={() => {
                    setOpen(false);
                    window.location.href = "/local-setup";
                  }}
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  View Full Setup Guide
                </Button>
              </div>
            )}

            <Button
              variant="hero"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Save & Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
