import { useRef, useMemo } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface ReliefMeshProps {
  depthMapUrl: string;
}

const ReliefMesh = ({ depthMapUrl }: ReliefMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, depthMapUrl);

  const displacementMap = useMemo(() => {
    const clone = texture.clone();
    clone.needsUpdate = true;
    return clone;
  }, [texture]);

  const colorMap = useMemo(() => {
    const clone = texture.clone();
    clone.needsUpdate = true;
    return clone;
  }, [texture]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-0.3, 0, 0]}>
      <planeGeometry args={[4, 5, 256, 320]} />
      <meshStandardMaterial
        displacementMap={displacementMap}
        displacementScale={1.2}
        map={colorMap}
        color="#d4a574"
        side={THREE.DoubleSide}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
};

interface ReliefViewerProps {
  depthMapUrl: string;
}

const ReliefViewer = ({ depthMapUrl }: ReliefViewerProps) => {
  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden border border-border bg-card">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#1a1d23"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, 3, 2]} intensity={0.5} color="#d4a574" />
        <pointLight position={[0, 3, 3]} intensity={0.6} color="#ffffff" />
        <ReliefMesh depthMapUrl={depthMapUrl} />
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          minDistance={2}
          maxDistance={10}
        />
      </Canvas>
    </div>
  );
};

export default ReliefViewer;
