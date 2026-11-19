'use client';

import { useEffect, useRef, useState } from 'react';

export default function SupplyScene() {
  const backdrop = useRef(null);
  const playback = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let dispose;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    async function start() {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const { mountSupplyScene } = await import('./supply-world');
      if (cancelled) return;
      dispose = mountSupplyScene(backdrop.current, next => {
        playback.current = next;
        setReady(true);
      }, setPlaying, motion);
    }

    start().catch(() => {
      if (!cancelled) setReady(false);
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <>
      <div className="supply-scene" ref={backdrop} aria-hidden="true">
        {!ready && (
          <div className="supply-fallback">
            <div className="fallback-stack">
              {['base', 'top', 'side'].map(position => (
                <div className={`fallback-crate fallback-crate--${position}`} key={position}>
                  <div className="crate-front">FIELD SUPPLY</div>
                  <div className="crate-lid" />
                  <div className="crate-end" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {ready && (
        <button className="scene-control" type="button" onClick={() => playback.current?.()}>
          {playing ? 'Pause scene' : 'Play scene'}
        </button>
      )}
    </>
  );
}
