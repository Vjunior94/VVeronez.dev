'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas!.width = w;
      canvas!.height = h;
      renderer.setSize(w, h, false);
      if (uniforms) uniforms.uResolution.value.set(w, h);
    }

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uColor1: { value: new THREE.Color(0xb8826b) },
      uColor2: { value: new THREE.Color(0xd8a890) },
      uColor3: { value: new THREE.Color(0x6e3850) },
      uColor4: { value: new THREE.Color(0xc8839a) },
      uBgColor: { value: new THREE.Color(0x0a0e1c) },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      uniform vec3 uBgColor;

      varying vec2 vUv;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * snoise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      float blob(vec2 uv, vec2 center, float radius) {
        float d = distance(uv, center);
        return smoothstep(radius, 0.0, d);
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 p = vec2((uv.x - 0.5) * aspect + 0.5, uv.y);

        float t = uTime * 0.08;

        vec2 b1 = vec2(0.5 + cos(t * 1.1) * 0.35 + sin(t * 0.7) * 0.1,
                       0.5 + sin(t * 0.9) * 0.3);
        vec2 b2 = vec2(0.5 + sin(t * 1.3) * 0.4,
                       0.5 + cos(t * 1.7) * 0.25 + sin(t * 0.5) * 0.1);
        vec2 b3 = vec2(0.5 + cos(t * 0.6 + 2.0) * 0.45,
                       0.5 + sin(t * 1.5 + 1.0) * 0.35);
        vec2 b4 = vec2(0.5 + sin(t * 0.8 + 4.0) * 0.4,
                       0.5 + cos(t * 1.2 + 3.0) * 0.3);

        b1.x = (b1.x - 0.5) * aspect + 0.5;
        b2.x = (b2.x - 0.5) * aspect + 0.5;
        b3.x = (b3.x - 0.5) * aspect + 0.5;
        b4.x = (b4.x - 0.5) * aspect + 0.5;

        float noiseDist = fbm(p * 1.8 + vec2(t * 0.3, -t * 0.2));
        vec2 distP = p + vec2(noiseDist) * 0.12;

        float i1 = blob(distP, b1, 0.55);
        float i2 = blob(distP, b2, 0.5);
        float i3 = blob(distP, b3, 0.6);
        float i4 = blob(distP, b4, 0.45);

        float total = i1 + i2 + i3 + i4 + 0.001;
        vec3 color = (uColor1 * i1 + uColor2 * i2 + uColor3 * i3 + uColor4 * i4) / total;
        float intensity = clamp((i1 + i2 + i3 + i4) * 0.55, 0.0, 1.0);

        vec3 finalColor = mix(uBgColor, color * 0.32, intensity);

        float grain = (snoise(uv * 800.0 + uTime * 50.0)) * 0.012;
        finalColor += grain;

        vec2 vUv2 = vUv - 0.5;
        float vignette = 1.0 - dot(vUv2, vUv2) * 0.6;
        finalColor *= vignette;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    const quadMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });
    const quad = new THREE.Mesh(quadGeom, quadMat);
    scene.add(quad);

    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      uniforms.uMouse.value.set(
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight
      );
    };
    document.addEventListener('mousemove', onMouseMove);

    const startTime = performance.now();
    let animId: number;
    function tick() {
      uniforms.uTime.value = (performance.now() - startTime) * 0.001;
      renderer.render(scene, camera);
      animId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animId);
      quadGeom.dispose();
      quadMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas id="hero-canvas" ref={canvasRef} />;
}
