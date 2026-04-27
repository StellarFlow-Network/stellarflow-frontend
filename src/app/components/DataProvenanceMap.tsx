"use client";

import * as React from "react";

const { useEffect, useRef } = React;

interface DataNode {
  id: string;
  x: number;
  y: number;
  label: string;
  status: "online" | "offline" | "syncing";
}

interface DataFlowConnection {
  from: string;
  to: string;
  strength: number;
}

interface DataProvenanceMapProps {
  width?: number;
  height?: number;
  className?: string;
}

const DataProvenanceMap: React.FC<DataProvenanceMapProps> = ({
  width = 400,
  height = 300,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Create offscreen canvas for double-buffering
    const offscreen = new OffscreenCanvas(width, height);
    const offscreenCtx = offscreen.getContext("2d");
    if (!offscreenCtx) return;

    // Define data nodes
    const nodes: DataNode[] = [
      { id: "oracle-1", x: width * 0.5, y: height * 0.3, label: "Oracle", status: "online" },
      { id: "node-1", x: width * 0.75, y: height * 0.5, label: "Node A", status: "online" },
      { id: "node-2", x: width * 0.25, y: height * 0.5, label: "Node B", status: "syncing" },
      { id: "node-3", x: width * 0.6, y: height * 0.75, label: "Node C", status: "online" },
    ];

    // Define connections
    const connections: DataFlowConnection[] = [
      { from: "oracle-1", to: "node-1", strength: 0.9 },
      { from: "oracle-1", to: "node-2", strength: 0.6 },
      { from: "oracle-1", to: "node-3", strength: 0.8 },
    ];

    const timeRef = { current: 0 };
    const pulseRings: Array<{ x: number; y: number; radius: number; alpha: number; speed: number }> = [];

    const draw = () => {
      const time = timeRef.current;

      // Clear offscreen
      offscreenCtx.clearRect(0, 0, width, height);

      // Draw connections
      connections.forEach((conn) => {
        const fromNode = nodes.find((n) => n.id === conn.from);
        const toNode = nodes.find((n) => n.id === conn.to);
        if (!fromNode || !toNode) return;

        offscreenCtx.beginPath();
        offscreenCtx.moveTo(fromNode.x, fromNode.y);
        offscreenCtx.lineTo(toNode.x, toNode.y);

        const alpha = conn.strength * 0.4 + Math.sin(time * 2) * 0.1;
        offscreenCtx.strokeStyle = `rgba(57, 255, 20, ${alpha})`;
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.stroke();

        // Animate data flow along connection
        const flowOffset = ((time * 50) % 100) / 100;
        const fx = fromNode.x + (toNode.x - fromNode.x) * flowOffset;
        const fy = fromNode.y + (toNode.y - fromNode.y) * flowOffset;

        offscreenCtx.beginPath();
        offscreenCtx.arc(fx, fy, 3, 0, Math.PI * 2);
        offscreenCtx.fillStyle = `rgba(217, 249, 157, ${0.5 + Math.sin(time * 3) * 0.3})`;
        offscreenCtx.fill();
      });

      // Draw nodes
      nodes.forEach((node) => {
        const colors = {
          online: "#39FF14",
          syncing: "#FACC15",
          offline: "#A1A1AA",
        };
        const color = colors[node.status];
        const isOnline = node.status === "online";

        // Glow
        const glowSize = isOnline ? 15 + Math.sin(time * 3 + node.x) * 3 : 8;
        const gradient = offscreenCtx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          glowSize
        );
        gradient.addColorStop(0, color + "40");
        gradient.addColorStop(1, color + "00");

        offscreenCtx.beginPath();
        offscreenCtx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        offscreenCtx.fillStyle = gradient;
        offscreenCtx.fill();

        // Node core
        offscreenCtx.beginPath();
        offscreenCtx.arc(node.x, node.y, isOnline ? 5 : 4, 0, Math.PI * 2);
        offscreenCtx.fillStyle = color;
        offscreenCtx.fill();
      });

      // Pulse rings from oracle
      for (let i = pulseRings.length - 1; i >= 0; i--) {
        const ring = pulseRings[i];
        ring.radius += ring.speed;
        ring.alpha -= 0.008;

        if (ring.alpha <= 0 || ring.radius > width * 0.4) {
          pulseRings.splice(i, 1);
          continue;
        }

        offscreenCtx.beginPath();
        offscreenCtx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        offscreenCtx.strokeStyle = `rgba(57, 255, 20, ${ring.alpha})`;
        offscreenCtx.lineWidth = 1;
        offscreenCtx.stroke();
      }

      // Spawn pulse rings
      if (Math.random() < 0.015) {
        const oracle = nodes.find((n) => n.id === "oracle-1");
        if (oracle) {
          pulseRings.push({
            x: oracle.x,
            y: oracle.y,
            radius: 10,
            alpha: 0.4,
            speed: 1.5,
          });
        }
      }

      // Composite to main canvas
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(offscreen, 0, 0, width, height);
    };

    const animate = () => {
      timeRef.current += 0.016;
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className={className}
        aria-label="Data provenance network map"
      />
    </div>
  );
};

export default DataProvenanceMap;
