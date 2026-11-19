import SupplyScene from './supply-scene';
import AnatomySection from './anatomy-section';

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-labelledby="home-title">
        <SupplyScene />
        <div className="hero-content">
          <p className="eyebrow">Unofficial WARDOGS companion</p>
          <h1 id="home-title">WARDOGS<span>BUDDY</span></h1>
          <p>Track your class XP, compare your rounds, and get ready for your next match.</p>
          <div className="actions">
            <a className="primary" href="/xp-tracker/">Open XP Tracker <span aria-hidden="true">→</span></a>
            <a className="secondary" href="/guides/">Browse guides</a>
          </div>
        </div>
        <a className="scroll-cue" href="#anatomy">Anatomy of a shot <span aria-hidden="true">↓</span></a>
      </section>
      <AnatomySection />
    </main>
  );
}
