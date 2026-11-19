import { topics } from './topics';

export const metadata = { title: 'Guides' };

export default function GuidesPage() {
  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Learn the basics</p>
        <h1 className="page-title">Guides</h1>
        <p className="page-lead">Short guides on class tracks, vehicle rounds and how to get reliable numbers out of the XP Tracker.</p>
      </header>
      <div className="guide-grid">
        {Object.entries(topics).map(([slug, topic]) => (
          <a className="guide-card" href={`/guides/${slug}/`} key={slug}>
            <p className="eyebrow">{topic.sections.length} sections</p>
            <h2>{topic.title} <span aria-hidden="true">→</span></h2>
            <p>{topic.summary}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
