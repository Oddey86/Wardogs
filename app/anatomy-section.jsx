'use client';

import { useEffect, useRef } from 'react';

const duration = 20000;

export default function AnatomySection() {
  const host = useRef(null);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let scene;
    let frame;
    let disposed = false;
    let elapsed = 0;
    let previous;

    function draw(now) {
      if (previous !== undefined) elapsed += now - previous;
      previous = now;
      scene.renderFilm(Math.min(elapsed / duration, 1));
      if (elapsed < duration) frame = requestAnimationFrame(draw);
    }

    function sync() {
      cancelAnimationFrame(frame);
      previous = undefined;
      if (!scene || document.hidden) return;
      if (motion.matches) scene.renderFilm(1);
      else if (elapsed < duration) frame = requestAnimationFrame(draw);
    }

    async function start() {
      const { mountAnatomyScene } = await import('./anatomy-world');
      if (disposed) return;
      scene = mountAnatomyScene(host.current);
      scene.renderFilm(0);
      host.current.dataset.ready = 'true';
      sync();
    }
    start().catch(() => { if (!disposed) host.current.dataset.ready = 'false'; });
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      scene?.dispose();
    };
  }, []);

  return (
    <section id="anatomy" className="shot-film" aria-labelledby="film-title">
      <div className="film-screen" ref={host} aria-hidden="true" />
      <div className="film-title">
        <p className="eyebrow">Unofficial WARDOGS companion</p>
        <h1 id="film-title">Anatomy of a shot<span>.</span></h1>
      </div>
    </section>
  );
}
