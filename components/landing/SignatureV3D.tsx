'use client';

import { useEffect, useRef, useState } from 'react';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Shape,
  ExtrudeGeometry,
  Group,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  Mesh,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  DoubleSide,
} from 'three';
import HandSignatureSVG from './HandSignatureSVG';

interface SignatureV3DProps {
  variant: 'hero' | 'footer';
}

export default function SignatureV3D({ variant }: SignatureV3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(variant === 'hero');

  // For footer variant, only init Three.js when visible
  useEffect(() => {
    if (variant === 'hero') return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [variant]);

  useEffect(() => {
    if (!isVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    function buildLogoV() {
      const shape = new Shape();
      const w = 0.18;
      const halfW = 0.7;
      const halfH = 0.95;

      shape.moveTo(-halfW, halfH);
      shape.lineTo(0, -halfH);
      shape.lineTo(halfW, halfH);
      shape.lineTo(halfW - w * 1.4, halfH);
      shape.lineTo(0, -halfH + w * 1.6);
      shape.lineTo(-halfW + w * 1.4, halfH);
      shape.lineTo(-halfW, halfH);

      const geom = new ExtrudeGeometry(shape, {
        depth: 0.35,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2,
        curveSegments: 6,
      });
      geom.center();
      return geom;
    }

    const logoGeom = buildLogoV();
    const logoGroup = new Group();

    const ambient = new AmbientLight(0x6e5040, 0.45);
    scene.add(ambient);

    const keyLight = new DirectionalLight(0xfff5e8, 1.1);
    keyLight.position.set(3, 2, 4);
    scene.add(keyLight);

    const rimLight = new DirectionalLight(0xb8826b, 0.35);
    rimLight.position.set(-3, -1, -2);
    scene.add(rimLight);

    const meshMat = new MeshStandardMaterial({
      color: 0xf0e0d0,
      metalness: 0.4,
      roughness: 0.55,
      transparent: true,
      opacity: 0.85,
      side: DoubleSide,
      depthWrite: false,
    });
    const meshV = new Mesh(logoGeom, meshMat);
    logoGroup.add(meshV);

    const edgesGeom = new EdgesGeometry(logoGeom, 20);
    const edgesMat = new LineBasicMaterial({
      color: 0xd8c8b8,
      transparent: true,
      opacity: 0.9,
    });
    const edgesV = new LineSegments(edgesGeom, edgesMat);
    logoGroup.add(edgesV);

    logoGroup.scale.set(1.5, 1.5, 1.5);
    scene.add(logoGroup);

    const V_MIN = 0.18;
    const V_MAX = 4.5;
    const SPEED_K = 3.0;

    let angleY = 0;
    let lastTime = performance.now();

    const sigWrap = wrapRef.current;
    let shimmerPos = -20;
    let shimmerOpacity = 0;
    let shimmerActive = false;
    let prevAccel = false;

    const startTime = performance.now();
    let animId: number;

    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const facing = Math.abs(Math.cos(angleY));
      const t01 = Math.pow(1 - facing, SPEED_K);
      const omega = V_MIN + (V_MAX - V_MIN) * t01;

      angleY += omega * dt;

      logoGroup.rotation.y = angleY;
      const tAbs = (now - startTime) * 0.001;
      logoGroup.rotation.x = Math.sin(tAbs * 0.4) * 0.18;
      logoGroup.rotation.z = Math.sin(tAbs * 0.3) * 0.04;

      const visibility = (() => {
        if (facing >= 0.4) return 1;
        if (facing <= 0.08) return 0.15;
        const t = (facing - 0.08) / (0.4 - 0.08);
        return 0.15 + 0.85 * t * t * (3 - 2 * t);
      })();
      meshMat.opacity = 0.85 * visibility;
      edgesMat.opacity = 0.9 * visibility;

      if (sigWrap) {
        const isAccel = t01 > 0.3;

        if (isAccel && !prevAccel) {
          shimmerPos = -20;
          shimmerActive = true;
        }
        prevAccel = isAccel;

        if (shimmerActive) {
          shimmerPos += (45 + t01 * 160) * dt;

          const progress = (shimmerPos + 20) / 140;
          const clamped = Math.max(0, Math.min(1, progress));
          const bell = Math.sin(clamped * Math.PI);
          shimmerOpacity = bell * bell * 0.85 + bell * 0.15;

          if (shimmerPos >= 120) {
            shimmerActive = false;
            shimmerOpacity = 0;
          }
        }

        sigWrap.style.setProperty('--shimmer-pos', shimmerPos.toFixed(1) + '%');
        sigWrap.style.setProperty('--shimmer-opacity', shimmerOpacity.toFixed(3));
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
      logoGeom.dispose();
      meshMat.dispose();
      edgesGeom.dispose();
      edgesMat.dispose();
      renderer.dispose();
    };
  }, [variant, isVisible]);

  const signatureClass = variant === 'hero' ? 'signature signature-hero' : 'signature signature-footer';

  return (
    <div className={signatureClass} ref={containerRef}>
      <canvas
        className="signature-canvas"
        ref={canvasRef}
      />
      <div className="signature-svg-wrap" ref={wrapRef}>
        <HandSignatureSVG className="hand-signature-svg" />
        <HandSignatureSVG className="hand-signature-svg shimmer" ariaHidden />
      </div>
    </div>
  );
}
