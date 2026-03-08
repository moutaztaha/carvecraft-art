import { useState, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageUpload from "@/components/ImageUpload";
import DepthMapDisplay from "@/components/DepthMapDisplay";
import ReliefViewer from "@/components/ReliefViewer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [depthMap, setDepthMap] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"depth" | "3d">("depth");
  const [quality, setQuality] = useState<"fast" | "high">("high");

  const generateDepthMap = async () => {
    if (!sourceImage) return;
    setIsGenerating(true);
    setDepthMap(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-depth-map", {
        body: { imageBase64: sourceImage, quality },
      });

      if (error) {
        console.error("Function error:", error);
        toast.error("Failed to generate depth map. Please try again.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.depthMap) {
        setDepthMap(data.depthMap);
        setActiveTab("depth");
        toast.success("Depth map generated successfully!");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setDepthMap(null);
  };

  return (
    <div className="min-h-screen gradient-dark">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md gradient-copper flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-gradient-copper">Relief</span>
              <span className="text-foreground">Forge</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground hidden sm:block font-mono">
            Line Art → Depth Map → CNC Relief
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        {!sourceImage && !depthMap && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto mb-12 pt-8"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Transform Line Art into{" "}
              <span className="text-gradient-copper">CNC-Ready</span> Depth Maps
            </h2>
            <p className="text-muted-foreground text-lg">
              Upload your ornament design and get a professional depth map for bas-relief
              engraving — powered by AI.
            </p>
          </motion.div>
        )}

        <div className="max-w-7xl mx-auto">
          {/* Source Image Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                  Source Image
                </h3>
                {sourceImage && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Reset
                  </Button>
                )}
              </div>
              <ImageUpload
                onImageSelect={setSourceImage}
                currentImage={sourceImage}
                onClear={() => {
                  setSourceImage(null);
                  setDepthMap(null);
                }}
              />
              {sourceImage && !depthMap && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {/* Quality Selector */}
                  <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    <button
                      onClick={() => setQuality("fast")}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                        quality === "fast"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ⚡ Fast Preview
                    </button>
                    <button
                      onClick={() => setQuality("high")}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                        quality === "high"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ✨ High Quality
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center font-mono">
                    {quality === "fast" ? "Faster generation, basic gradients" : "Slower generation, rich sculptural detail"}
                  </p>
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={generateDepthMap}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating Depth Map...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Depth Map
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Result Section */}
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {isGenerating && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-[400px] rounded-lg border border-border bg-card"
                  >
                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground font-mono text-sm">
                      AI is sculpting your depth map...
                    </p>
                  </motion.div>
                )}

                {depthMap && !isGenerating && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {/* Tabs */}
                    <div className="flex gap-1 mb-4 bg-secondary rounded-lg p-1">
                      <button
                        onClick={() => setActiveTab("depth")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                          activeTab === "depth"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Depth Map
                      </button>
                      <button
                        onClick={() => setActiveTab("3d")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                          activeTab === "3d"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        3D Preview
                      </button>
                    </div>

                    {activeTab === "depth" && <DepthMapDisplay depthMapUrl={depthMap} />}
                    {activeTab === "3d" && (
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-[500px] rounded-lg border border-border bg-card">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          </div>
                        }
                      >
                        <ReliefViewer depthMapUrl={depthMap} />
                      </Suspense>
                    )}

                    <Button
                      variant="hero-outline"
                      size="lg"
                      className="w-full mt-4"
                      onClick={generateDepthMap}
                      disabled={isGenerating}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </motion.div>
                )}

                {!depthMap && !isGenerating && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-[400px] rounded-lg border border-dashed border-border bg-card/30"
                  >
                    <p className="text-muted-foreground text-sm font-mono">
                      Result will appear here
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
