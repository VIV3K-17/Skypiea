// ConfettiBlast.jsx
import React, { useEffect, useRef } from "react";

/**
 * ConfettiBlast.jsx
 *
 * Features:
 *  - Canvas-based, physics-driven confetti with metallic/gem palettes
 *  - Chromatic reflections, anisotropic shine, gloss masks
 *  - Light direction (simulate spotlight) and lens bloom (additive overlay)
 *  - Slow-motion (cinematic) option
 *  - High-DPI support, substepping for smooth physics
 *  - Adaptive particle count (save-data, small screens)
 *
 * Props:
 *  - show (bool) -> start blast when true
 *  - onComplete (fn) -> called when finished
 *  - duration (ms) default 3500
 *  - particleCount default 420
 *  - minSize default 3
 *  - maxSize default 9
 *  - gravity default 2400 (px/s^2)
 *  - drag default 0.996
 *  - windBase default 0
 *  - spread default 100 (degrees)
 *  - origin default {x:0.5,y:0}
 *  - maxParticlesCap default 1200
 *  - lightDir default {x: 0.2, y: -1}  (directional light vector)
 *  - bloomStrength default 0.5 (0..1)
 *  - slowMotion default false (true slows simulation for cinematic effect)
 */

const ConfettiBlast = ({
  show,
  onComplete,
  duration = 3000, // adjusted to 3 seconds per requirement
  particleCount = 420,
  minSize = 3,
  maxSize = 9,
  gravity = 800, // lowered for feather-like descent
  drag = 0.996,
  windBase = 0,
  spread = 100,
  origin = { x: 0.5, y: 0 },
  maxParticlesCap = 1200,
  lightDir = { x: 0.2, y: -1 },
  bloomStrength = 0.5,
  slowMotion = false,
  successSoundUrl = "/success.mp3", // public path for success sound
}) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const particlesRef = useRef([]);
  const finishedRef = useRef(false);
  const audioRef = useRef(null);

  // Desktop-only guard
  const isDesktop = () => {
    if (typeof window === "undefined") return false;
    const mobileRegex = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return window.innerWidth >= 1024 && !mobileRegex.test(navigator.userAgent);
  };

  // Helpers
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const degToRad = (d) => (d * Math.PI) / 180;

  // Metallic + gem palette (rich, shiny)
  const metallicPalette = [
    '#F9D976', '#F7C948', '#F4B400', '#DFAE37', // golds
    '#E6E6E6', '#CFCFCF', '#B8B8B8', '#A1A1A1', // silvers
    '#E84A5F', '#FF6B6B', // ruby
    '#4ED5C9', '#4ECDC4', // aquamarine
    '#3B9AD3', '#45B7D1', // sapphires
    '#B084F9', '#8E6AFF', // amethyst
    '#8AE2B8', '#96CEB4', // emerald / mint
    '#FFD166', '#FFB86B', // warm highlights
  ];

  const pickColor = (i) => metallicPalette[(i * 31) % metallicPalette.length];

  // Normalize light direction and compute helper constants
  const normalize = (v) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
    return { x: v.x / len, y: v.y / len };
  };
  const L = normalize(lightDir);

  // Convert hex to RGB object
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return { r, g, b };
  };

  // Brighten color by factor (0..)
  const brightenRGB = (rgb, factor) => {
    return {
      r: clamp(Math.round(rgb.r + factor * 255), 0, 255),
      g: clamp(Math.round(rgb.g + factor * 255), 0, 255),
      b: clamp(Math.round(rgb.b + factor * 255), 0, 255),
    };
  };

  // Chromatic shift: returns CSS rgba string with slight RGB offsets
  const chromaticShift = (rgb, phase) => {
    // phase -1..1 drives color separation
    const shift = phase * 6; // px-intensity for chroma
    const r = clamp(rgb.r + shift, 0, 255);
    const g = clamp(rgb.g + shift * 0.3, 0, 255);
    const b = clamp(rgb.b - shift * 0.5, 0, 255);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 1)`;
  };

  // shineColor: combine base color + specular highlight from rotation and light direction
  const shineColor = (baseHex, rotation, nx = 0, ny = 0) => {
    // base rgb
    const base = hexToRgb(baseHex);

    // projected normal approximation: for flat particles, normal varies with rotation and tilt
    // nx/ny are optional per-particle tilt components to bias the specular
    // dot = L · N approximated by sin(rotation)*... etc
    const rotFactor = Math.abs(Math.sin(rotation * 2.0)); // 0..1
    const dot = clamp(L.x * (nx * 0.6 + Math.cos(rotation) * 0.4) + L.y * (ny * 0.6 + Math.sin(rotation) * 0.4), -1, 1);

    // shimmer: a sharp specular highlight when facing light
    const specStrength = Math.pow(clamp((dot + 1) / 2 + rotFactor * 0.4, 0, 1), 6); // sharper curve

    // base brighten from specular
    const bright = brightenRGB(base, specStrength * 0.7);

    // Add a small chromatic tint tied to rotation (gives that prismatic foil effect)
    const chromaPhase = Math.sin(rotation * 3 + nx * 2 + ny * 1.5);
    const chroma = chromaticShift(bright, chromaPhase * 0.25);

    return { fill: `rgba(${bright.r}, ${bright.g}, ${bright.b}, 1)`, chroma };
  };

  // Resize canvas for DPR
  const resizeCanvas = (canvas) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  };

  // Create particles
  const createParticles = (w, h) => {
    let finalCount = particleCount;
    if (w < 1400) finalCount = Math.round(finalCount * 0.7);
    if (w < 1000) finalCount = Math.round(finalCount * 0.5);
    finalCount = Math.min(finalCount, maxParticlesCap);

    // respect save-data
    try {
      if (navigator && navigator.connection && navigator.connection.saveData) {
        finalCount = Math.min(finalCount, 180);
      }
    } catch (e) {}

    // slow-motion: lengthen ttl slightly and reduce initial speed
    const slowFactor = slowMotion ? 0.55 : 1;

    const originX = origin.x * w;
    const originY = origin.y * h;

    const arr = new Array(finalCount).fill(0).map((_, i) => {
      // Lower initial speed for softer launch (feather effect)
      const speed = rand(260, 900) * slowFactor;
      const baseAngle = -90;
      const angle = baseAngle + rand(-spread / 2, spread / 2);
      const rad = degToRad(angle);
      const vx = Math.cos(rad) * speed;
      const vy = Math.sin(rad) * speed;

      const size = rand(minSize, maxSize);
      const chooser = Math.random();
      let shape = "square";
      if (chooser < 0.20) shape = "circle";
      else if (chooser < 0.40) shape = "triangle";
      else if (chooser < 0.80) shape = "square";
      else shape = "ribbon";

      // random tilt/normal approx for anisotropic shine
      const nx = rand(-0.8, 0.8);
      const ny = rand(-0.8, 0.8);

      return {
        id: i,
        x: originX + rand(-260, 260), // wide spawn
        y: originY + rand(-18, 18),
        vx, vy,
        size,
        color: pickColor(i),
        rotation: rand(0, Math.PI * 2),
        angularVel: rand(-8, 8),
        shape,
        life: 0,
        ttl: rand(duration * 0.9, duration * 1.4) / slowFactor, // longer if slow motion
        opacity: 1,
        wobble: rand(0, 2000),
        tilt: rand(-0.6, 0.6),
        nx, ny,
        localWindSeed: rand(0, 1000),
      };
    });

    particlesRef.current = arr;
  };

  // Draw a single particle with metallic/chromatic/gloss effects
  const drawParticle = (ctx, p) => {
    ctx.save();
    ctx.globalAlpha = clamp(p.opacity, 0, 1);

    // Compute dynamic shine & chroma
    const sc = shineColor(p.color, p.rotation + p.tilt, p.nx, p.ny);
    // base fill (metallic)
    const baseFill = sc.fill;
    // chroma - subtle overlay for prismatic foil
    const chroma = sc.chroma;

    // draw main shape
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    const s = p.size;

    if (p.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fillStyle = baseFill;
      ctx.fill();
      // highlight rim
      ctx.lineWidth = Math.max(0.4, s * 0.08);
      ctx.strokeStyle = "rgba(255,255,255,0.23)";
      ctx.stroke();
    } else if (p.shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(s * 0.9, s * 0.6);
      ctx.lineTo(-s * 0.9, s * 0.6);
      ctx.closePath();
      ctx.fillStyle = baseFill;
      ctx.fill();
      ctx.lineWidth = Math.max(0.3, s * 0.06);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();
    } else if (p.shape === "ribbon") {
      // anisotropic ribbon: scale ellipse and add chroma overlay
      const wob = Math.sin((p.life + p.wobble) / 110) * (s * 0.9);
      ctx.beginPath();
      ctx.ellipse(wob, 0, s * 0.9, s * 0.28, Math.sin(p.life / 800) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = baseFill;
      ctx.fill();
      // chromatic quick stroke to simulate flip
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = chroma;
      ctx.globalAlpha = Math.max(0.06, clamp(Math.abs(Math.sin(p.rotation * 6)) * 0.35, 0, 0.5));
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = clamp(p.opacity, 0, 1);
      // subtle edge highlight
      ctx.lineWidth = Math.max(0.2, s * 0.05);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.stroke();
    } else {
      // square / default
      ctx.fillStyle = baseFill;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      // draw chroma overlay with additive blending when facing camera
      const faceFactor = Math.abs(Math.cos(p.rotation * 2));
      if (faceFactor > 0.12) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = chroma;
        ctx.globalAlpha = clamp(0.08 + faceFactor * 0.12, 0, 0.35);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = clamp(p.opacity, 0, 1);
      }
      // highlight stroke
      ctx.lineWidth = Math.max(0.2, s * 0.06);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    }
    ctx.restore();
  };

  // Main loop: physics + rendering (substepped)
  const loop = (timestamp) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!startRef.current) startRef.current = timestamp;
    const elapsed = timestamp - startRef.current;

    // time delta
    const last = loop.lastTs || timestamp;
    let frameDt = (timestamp - last) / 1000;
    loop.lastTs = timestamp;
    // clamp big frame deltas
    if (frameDt > 0.064) frameDt = 0.064;

    // substeps for stability / smoothness
    const substeps = 3;
    const dt = frameDt / substeps;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // clear entire canvas
    ctx.clearRect(0, 0, w, h);

    // Render bloom layer separately (lighter) for strong highlights
    // We'll draw main scene, then an additive bloom pass of bright fragments
    // Approach: draw main (already includes some additive chroma). For bloom, we'll
    // create a composite where bright pixels are drawn again with "lighter" and low alpha.

    // Update + draw each particle
    let alive = 0;
    for (let p of particlesRef.current) {
      for (let s = 0; s < substeps; s++) {
        // local wind evolving
        const localWind = windBase + Math.sin((p.localWindSeed + p.life) / 700) * 160;
        const slowFactor = slowMotion ? 0.6 : 1;
        // gravity scaled by slow-motion
        // Apply reduced gravity factor for slower fall
        p.vy += gravity * dt * slowFactor * 0.55;
        // wind influence (small)
        p.vx += (localWind * dt) * 0.16;

        // drag (approx per-frame)
        const dragFactor = Math.pow(drag, dt * 60);
        p.vx *= dragFactor;
        p.vy *= dragFactor;

        // integrate
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // soft horizontal flutter
        // Increase horizontal flutter amplitude for drifting feather motion
        p.x += Math.sin((p.life + p.wobble + s) / 240) * (p.size / 18);

        // rotation update; slowMotion reduces angular velocity slightly
        p.rotation += p.angularVel * dt * (slowMotion ? 0.9 : 1);

        p.life += dt * 1000;
      }

      // fade near end
      const fadeStart = p.ttl * 0.72;
      if (p.life > fadeStart) {
        p.opacity = 1 - (p.life - fadeStart) / (p.ttl - fadeStart);
      }

      // kill if below bottom (subtle)
      if (p.y > h + 60 || p.opacity <= 0.01) {
        p.opacity = 0;
      } else {
        // draw main particle
        drawParticle(ctx, p);
        alive++;
      }
    }

    // Additive bloom pass: render bright highlights with 'lighter' blend
    // We'll iterate again and draw tiny luminous ellipses where specStrength > threshold
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let p of particlesRef.current) {
      // compute brightness indicator from rotation and light direction
      const rotFactor = Math.abs(Math.sin((p.rotation + p.tilt) * 3));
      const dot = clamp(L.x * (p.nx * 0.6 + Math.cos(p.rotation) * 0.4) + L.y * (p.ny * 0.6 + Math.sin(p.rotation) * 0.4), -1, 1);
      const specStrength = Math.pow(clamp((dot + 1) / 2 + rotFactor * 0.4, 0, 1), 5);

      if (specStrength > 0.22 && p.opacity > 0.06) {
        // draw a small glow
        const glowRadius = p.size * (1.2 + specStrength * 2.0) * (1 + bloomStrength);
        // pick bright color from base
        const base = hexToRgb(p.color);
        ctx.fillStyle = `rgba(${Math.min(255, base.r + 80)}, ${Math.min(255, base.g + 80)}, ${Math.min(255, base.b + 120)}, ${clamp(specStrength * 0.12 * bloomStrength * p.opacity, 0, 0.5)})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - Math.abs(p.vy) * 0.0025, glowRadius, glowRadius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // finish criteria
    if (alive === 0 || elapsed > duration * 1.8) {
      finishedRef.current = true;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (onComplete) onComplete();
      return;
    }

    rafRef.current = requestAnimationFrame(loop);
  };

  // start & cleanup
  useEffect(() => {
    if (!show) {
      // cancel if active
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    if (!isDesktop()) {
      // don't run on mobile/tablet
      if (onComplete) onComplete();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Play success sound (desktop only) when animation begins
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.catch(() => {/* ignore autoplay block */});
        }
      } catch (e) {
        // silent fail
      }
    }

    // initial resize and spawn
    resizeCanvas(canvas);
    createParticles(window.innerWidth, window.innerHeight);

    finishedRef.current = false;
    startRef.current = null;
    loop.lastTs = null;

    rafRef.current = requestAnimationFrame(loop);

    const onResize = () => {
      resizeCanvas(canvas);
      // don't recreate particles on resize to keep the animation smooth
    };
    window.addEventListener("resize", onResize);

    // safety: force finish eventually
    const safety = setTimeout(() => {
      if (!finishedRef.current) {
        particlesRef.current.forEach((p) => (p.life = p.ttl + 1));
      }
    }, duration * 2 + 900);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearTimeout(safety);
      // clear canvas
      const ctx = canvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show || !isDesktop()) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 9999,
          willChange: "transform",
        }}
      />
      <audio ref={audioRef} src={successSoundUrl} preload="auto" style={{ display: "none" }} />
      <style>{`
        canvas { animation: confetti-fadein 220ms ease-out; }
        @keyframes confetti-fadein { from { opacity: 0; transform: scale(0.998); } to { opacity: 1; transform: none; } }
      `}</style>
    </>
  );
};

export default ConfettiBlast;
