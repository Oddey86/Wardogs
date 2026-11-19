'use client';

import { useEffect, useRef } from 'react';

// Each sheet contains six consecutive Blender views, including both moving rotors.
const frames = 120;
const tileWidth = 896;
const tileHeight = 480;
const circuitMs = 12000;

export default function AirPatrol() {
  const stage = useRef(null);
  const aircraft = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const images = new Map();
    let raf = 0, previous, elapsed = 0, shown = -1, visible = true;
    let width, height;

    function sheet(index) {
      if (!images.has(index)) {
        const img = new Image();
        img.src = '/air-patrol/orbit-' + index + '.webp';
        images.set(index, img);
      }
      return images.get(index);
    }

    function position(progress) {
      const angle = Math.PI * 2 * progress - .52;
      const near = (1 + Math.cos(angle)) / 2;
      const portrait = width / height < .9;
      const size = Math.min(height * .78, width * (portrait ? .36 + .24*near : .23 + .17*near));
      const laneStart = portrait ? 0 : width * .28;
      const x = (width + laneStart)/2 - Math.sin(angle) * (width-laneStart-size)*.48;
      const minY = size * tileHeight/tileWidth * .51;
      const y = Math.max(minY, height * (portrait ? .15 + .19*near : .25 + .32*near));
      aircraft.current.style.width = size + 'px';
      aircraft.current.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
    }

    function draw(now) {
      const dt = previous === undefined ? 0 : now-previous;
      previous = now;
      const next = (elapsed + dt) % circuitMs;
      const index = Math.floor(next * frames / circuitMs);
      const page = Math.floor(index / 6);
      const image = sheet(page);
      if (image.complete && image.naturalWidth) {
        elapsed = next;
        if (index !== shown) {
          const tile = index % 6;
          ctx.clearRect(0, 0, tileWidth, tileHeight);
          ctx.drawImage(image, (tile % 3)*tileWidth, Math.floor(tile/3)*tileHeight, tileWidth, tileHeight,
            0, 0, tileWidth, tileHeight);
          shown = index;
          aircraft.current.dataset.moving = 'true';
          const following = (page+1)%20;
          const after = (page+2)%20;
          sheet(following); sheet(after);
          for (const key of images.keys()) {
            if (key !== page && key !== following && key !== after) images.delete(key);
          }
        }
        position(elapsed / circuitMs);
      }
      raf = requestAnimationFrame(draw);
    }

    function sync() {
      cancelAnimationFrame(raf);
      previous = undefined;
      if (motion.matches) {
        shown = -1; elapsed = 0;
        delete aircraft.current.dataset.moving;
        position(0);
      } else if (visible && !document.hidden) {
        raf = requestAnimationFrame(draw);
      }
    }
    function resize() {
      width = stage.current.clientWidth;
      height = stage.current.clientHeight;
      position(elapsed / circuitMs);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage.current);
    const viewport = new IntersectionObserver(([entry]) => { visible=entry.isIntersecting; sync(); });
    viewport.observe(stage.current);
    document.addEventListener('visibilitychange',sync);
    motion.addEventListener('change',sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect(); viewport.disconnect();
      document.removeEventListener('visibilitychange',sync);
      motion.removeEventListener('change',sync);
      images.clear();
    };
  }, []);

  return (
    <section className="hero patrol" ref={stage} aria-labelledby="home-title">
      <div className="patrol-aircraft" ref={aircraft} aria-hidden="true">
        <img src="/air-patrol/kestrel.webp" alt="" width={tileWidth} height={tileHeight} fetchPriority="high" />
        <canvas ref={canvas} width={tileWidth} height={tileHeight} aria-hidden="true" />
      </div>
      <div className="hero-content">
        <p className="eyebrow">Unofficial WARDOGS companion</p>
        <h1 id="home-title">WARDOGS<span>BUDDY</span></h1>
        <p>Track your class XP, compare your rounds, and get ready for your next match.</p>
        <div className="actions">
          <a className="primary" href="/xp-tracker/">Open XP Tracker</a>
          <a className="secondary" href="/guides/">Browse guides</a>
        </div>
      </div>
    </section>
  );
}
