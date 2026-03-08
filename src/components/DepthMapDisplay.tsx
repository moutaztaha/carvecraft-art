import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepthMapDisplayProps {
  depthMapUrl: string;
}

const DepthMapDisplay = ({ depthMapUrl }: DepthMapDisplayProps) => {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = depthMapUrl;
    link.download = "depth-map.png";
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="rounded-lg overflow-hidden border border-border bg-card">
        <img
          src={depthMapUrl}
          alt="Generated depth map"
          className="w-full h-auto max-h-[500px] object-contain p-4"
        />
      </div>
      <Button onClick={handleDownload} variant="hero" size="lg" className="w-full">
        <Download className="w-5 h-5 mr-2" />
        Download Depth Map
      </Button>
    </motion.div>
  );
};

export default DepthMapDisplay;
