import * as React from "react";

const { useEffect, useRef } = React;

interface PulseNode {
  x: number;
  y: number;
  baseRadius: number;
  phase: number;
  color: string;
}

interface PulseRing {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
}

interface PulseCanvasProps {
  width?: number;
  height?: number;
  nodeCount?: number;
  pulseColor?: string;
  glowColor?: string;
  pulseSpeed?: number;
  className?: string;
}

const PulseCanvas: React.FC<PulseCanvasProps> = ({
  width = 200,
  height = 200,
  nodeCount = 4,
  pulseColor = "#39FF14",
  glowColor = "#CBF34D",
  pulseSpeed = 0.03,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<PulseNode[]>([]);
  const ringsRef = useRef<PulseRing[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Create offscreen canvas for double-buffered rendering
    const offscreen = new OffscreenCanvas(width, height);
    const offscreenCtx = offscreen.getContext("2d");
    if (!offscreenCtx) return;

    // Initialize node positions
    const centerX = width / 2;
    const centerY = height / 2;
    const nodeRadius = Math.min(width, height) * 0.35;
    const nodes: PulseNode[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      nodes.push({
        x: centerX + Math.cos(angle) * nodeRadius,
        y: centerY + Math.sin(angle) * nodeRadius,
        baseRadius: 3,
        phase: Math.random() * Math.PI * 2,
        color: i === 0 ? pulseColor : glowColor,
      });
    }
    // Center data hub node
    nodes.push({
      x: centerX,
      y: centerY,
      baseRadius: 5,
      phase: 0,
      color: pulseColor,
    });

    nodesRef.current = nodes;

    const draw = () => {
      const time = timeRef.current;

      // Clear offscreen canvas
      offscreenCtx.clearRect(0, 0, width, height);

      // Draw connection lines between nodes
      offscreenCtx.strokeStyle = "rgba(57, 255, 20, 0.12)";
      offscreenCtx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < Math.min(width, height) * 0.5) {
            const alpha = 0.15 * (1 - dist / (Math.min(width, height) * 0.5));
            offscreenCtx.strokeStyle = `rgba(57, 255, 20, ${alpha})`;
            offscreenCtx.beginPath();
            offscreenCtx.moveTo(nodes[i].x, nodes[i].y);
            offscreenCtx.lineTo(nodes[j].x, nodes[j].y);
            offscreenCtx.stroke();
          }
        }
      }

      // Draw nodes with glow effect
      nodes.forEach((node) => {
        const pulseOffset = Math.sin(time * 3 + node.phase) * 2;
        const currentRadius = Math.max(1, node.baseRadius + pulseOffset);
        const glowSize = 10 + pulseOffset * 2;

        // Radial glow gradient
        const gradient = offscreenCtx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          glowSize
        );
        gradient.addColorStop(0, node.color + "80");
        gradient.addColorStop(1, node.color + "00");

        offscreenCtx.beginPath();
        offscreenCtx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        offscreenCtx.fillStyle = gradient;
        offscreenCtx.fill();

        // Solid core
        offscreenCtx.beginPath();
        offscreenCtx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
        offscreenCtx.fillStyle = node.color;
        offscreenCtx.fill();
      });

      // Draw propagating pulse rings
      const rings = ringsRef.current;
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.radius += ring.speed;
        ring.alpha -= 0.012;

        if (ring.alpha <= 0) {
          rings.splice(i, 1);
          continue;
        }

        offscreenCtx.beginPath();
        offscreenCtx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        offscreenCtx.strokeStyle = `rgba(57, 255, 20, ${ring.alpha})`;
        offscreenCtx.lineWidth = 2;
        offscreenCtx.stroke();
      }

      // Occasionally spawn new pulse rings from random nodes
      if (Math.random() < 0.02 && nodes.length > 0) {
        const node = nodes[Math.floor(Math.random() * nodes.length)];
        rings.push({
          x: node.x,
          y: node.y,
          radius: 5,
          alpha: 0.5,
          speed: 1.2,
        });
      }

      // Data flow animation ring at center
      const flowPulse = Math.sin(time * 2) * 0.3 + 0.7;
      offscreenCtx.beginPath();
      offscreenCtx.arc(centerX, centerY, 20 + flowPulse * 8, 0, Math.PI * 2);
      offscreenCtx.strokeStyle = `rgba(217, 249, 157, ${0.12 * flowPulse})`;
      offscreenCtx.lineWidth = 1;
      offscreenCtx.stroke();

      // Composite: draw offscreen to onscreen canvas
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(offscreen, 0, 0, width, height);
    };

    const animate = () => {
      timeRef.current += pulseSpeed;
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height, nodeCount, pulseColor, glowColor, pulseSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Data provenance pulse animation"
    />
  );
};

export default PulseCanvas;


