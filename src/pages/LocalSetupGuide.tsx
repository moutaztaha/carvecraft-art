import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Terminal, Download, Play, CheckCircle2, ExternalLink, Copy, Check, Cpu, Monitor, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    title: "Install ComfyUI",
    icon: Download,
    content: (
      <>
        <p>Clone and set up ComfyUI on your machine:</p>
        <CodeBlock code={`git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt`} />
        <p className="text-xs text-muted-foreground mt-2">
          Requires Python 3.10+ and CUDA-compatible GPU. Your RTX A5000 (16GB VRAM) is ideal.
        </p>
      </>
    ),
  },
  {
    title: "Install Custom Nodes",
    icon: HardDrive,
    content: (
      <>
        <p>Install the ControlNet Auxiliary Preprocessors pack (includes Metric3D depth):</p>
        <CodeBlock code={`cd ComfyUI/custom_nodes
git clone https://github.com/Fannovel16/comfyui_controlnet_aux.git
cd comfyui_controlnet_aux
pip install -r requirements.txt`} />
        <p className="mt-3">This pack includes:</p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-1">
          <li><strong className="text-foreground">Metric3D</strong> — High-quality monocular depth (recommended)</li>
          <li><strong className="text-foreground">Depth Anything V2</strong> — Fast alternative</li>
          <li><strong className="text-foreground">MiDaS</strong> — Classic depth estimation</li>
        </ul>
      </>
    ),
  },
  {
    title: "Start ComfyUI with CORS",
    icon: Play,
    content: (
      <>
        <p>Launch ComfyUI with network access enabled:</p>
        <CodeBlock code={`python main.py --listen 0.0.0.0 --enable-cors-header`} />
        <p className="text-xs text-muted-foreground mt-2">
          ComfyUI will run on <code className="text-primary">http://localhost:8188</code>. 
          The <code className="text-primary">--enable-cors-header</code> flag allows the bridge server to communicate with it.
        </p>
      </>
    ),
  },
  {
    title: "Install & Run the Bridge Server",
    icon: Terminal,
    content: (
      <>
        <p>Install Python dependencies and start the bridge:</p>
        <CodeBlock code={`pip install fastapi uvicorn httpx`} />
        <p className="mt-3">Download the bridge files from the app:</p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-1">
          <li>
            <code className="text-primary">bridge_server.py</code> — The API server
          </li>
          <li>
            <code className="text-primary">comfyui-depth-workflow.json</code> — The ComfyUI workflow
          </li>
        </ul>
        <p className="mt-3">Place both files in the same folder and run:</p>
        <CodeBlock code={`python bridge_server.py`} />
        <p className="text-xs text-muted-foreground mt-2">
          Bridge runs on <code className="text-primary">http://localhost:8000</code> and forwards requests to ComfyUI.
        </p>
      </>
    ),
  },
  {
    title: "Configure ReliefForge",
    icon: Monitor,
    content: (
      <>
        <p>In the app, click the <strong>⚙️ gear icon</strong> in the header:</p>
        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 mt-2">
          <li>Select <strong className="text-foreground">Local GPU</strong> mode</li>
          <li>Set endpoint to <code className="text-primary">http://localhost:8000</code></li>
          <li>Click <strong className="text-foreground">Save & Close</strong></li>
        </ol>
        <p className="mt-3">Upload a line art image and hit Generate — the depth map will be processed entirely on your local GPU!</p>
      </>
    ),
  },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group mt-2">
      <pre className="bg-background border border-border rounded-lg p-3 text-sm font-mono text-foreground overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function LocalSetupGuide() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-dark">
      <header className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Local GPU Setup Guide</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 mb-10"
        >
          <h2 className="text-3xl font-bold">
            Run <span className="text-gradient-copper">ReliefForge</span> on Your GPU
          </h2>
          <p className="text-muted-foreground text-lg">
            Process depth maps locally using ComfyUI and a lightweight Python bridge — no internet or API keys required.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-secondary text-muted-foreground">Python 3.10+</span>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-secondary text-muted-foreground">CUDA GPU</span>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-secondary text-muted-foreground">~8GB VRAM min</span>
          </div>
        </motion.div>

        <div className="space-y-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-mono text-sm font-bold">
                  {i + 1}
                </div>
                <step.icon className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">{step.title}</h3>
              </div>
              <div className="text-sm text-muted-foreground pl-11 space-y-2">
                {step.content}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 bg-secondary/30 border border-border rounded-xl p-5 space-y-3"
        >
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Troubleshooting
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2 pl-6">
            <li><strong className="text-foreground">ComfyUI not connecting?</strong> — Ensure <code className="text-primary">--listen 0.0.0.0</code> is set and no firewall blocks port 8188.</li>
            <li><strong className="text-foreground">Metric3D node not found?</strong> — Restart ComfyUI after installing custom nodes. Check ComfyUI console for errors.</li>
            <li><strong className="text-foreground">Out of VRAM?</strong> — Add <code className="text-primary">--lowvram</code> flag when starting ComfyUI.</li>
            <li><strong className="text-foreground">Bridge timeout?</strong> — First run downloads model weights (~2GB). Subsequent runs are faster.</li>
          </ul>
        </motion.div>

        <div className="mt-8 flex gap-3">
          <Button variant="hero" onClick={() => navigate("/")}>
            ← Back to App
          </Button>
          <a href="https://github.com/comfyanonymous/ComfyUI" target="_blank" rel="noopener noreferrer">
            <Button variant="hero-outline">
              ComfyUI Docs <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
