'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { at: 0, title: 'Load', text: 'A round is pressed into the magazine. The spring underneath compresses and keeps the whole stack under tension.' },
  { at: 0.14, title: 'Insert', text: 'The magazine locks into the magwell. The top round now waits just below the bolt.' },
  { at: 0.26, title: 'Charge', text: 'Pulling the charging handle draws the bolt carrier back and cocks the hammer. On the way forward, the bolt strips the top round into the chamber.' },
  { at: 0.44, title: 'Trigger', text: 'Squeezing the trigger releases the hammer, which drives the firing pin into the primer.' },
  { at: 0.52, title: 'Fire', text: 'The powder burns and the gas pushes the bullet down the barrel. The same pressure cycles the bolt: the empty case is thrown clear and the next round is chambered.' },
  { at: 0.63, title: 'Flight', text: 'The bullet leaves the muzzle spinning from the rifling and carries on downrange to the steel.' },
];

const clamp = value => Math.min(1, Math.max(0, value));

export default function AnatomySection() {
  const section = useRef(null);
  const host = useRef(null);
  const bar = useRef(null);
  const [mode, setMode] = useState('static');
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let scene;
    let frame = 0;
    let lastP = -1;

    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return undefined;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    setMode('3d');

    function progress() {
      const rect = section.current.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      return { p: travel > 0 ? clamp(-rect.top / travel) : 0, visible: rect.bottom > 0 && rect.top < window.innerHeight };
    }

    function update() {
      frame = 0;
      const { p, visible } = progress();
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      let step = 0;
      STEPS.forEach((item, index) => { if (p >= item.at) step = index; });
      setActive(step);
      if (scene && visible && Math.abs(p - lastP) > 0.00005) {
        lastP = p;
        scene.render(p);
      }
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    // Load three.js and the scene only when the section is about to come into view.
    const loader = new IntersectionObserver(async entries => {
      if (!entries.some(entry => entry.isIntersecting) || scene) return;
      loader.disconnect();
      try {
        const { mountAnatomyScene } = await import('./anatomy-world');
        if (cancelled) return;
        scene = mountAnatomyScene(host.current, { mobile: window.matchMedia('(pointer: coarse)').matches });
        lastP = -1;
        update();
      } catch {
        if (!cancelled) setMode('static');
      }
    }, { rootMargin: '600px 0px' });
    loader.observe(section.current);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    return () => {
      cancelled = true;
      loader.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
      scene?.dispose();
    };
  }, []);

  return (
    <section className="anatomy" id="anatomy" ref={section} data-mode={mode} aria-labelledby="anatomy-title">
      <div className="anatomy-stage">
        <div className="anatomy-canvas" ref={host} aria-hidden="true" />
        <div className="anatomy-panel">
          <p className="eyebrow">From magazine to target</p>
          <h2 id="anatomy-title" className="page-title">Anatomy of a shot</h2>
          <ol className="anatomy-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className={index === active ? 'active' : undefined} aria-current={index === active ? 'step' : undefined}>
                <span className="anatomy-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="anatomy-progress" aria-hidden="true"><span ref={bar} /></div>
          <p className="anatomy-hint">Scroll to move through the shot. Scroll back to rewind.</p>
        </div>
      </div>
    </section>
  );
}
