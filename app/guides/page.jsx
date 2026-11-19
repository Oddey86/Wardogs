import { topics } from './topics';

export const metadata = { title: 'Guides' };

export default function GuidesPage() {
  return (
    <main className="guide-layout">
      <h1>Guides</h1>
      <div className="guide-grid">
        {Object.entries(topics).map(([slug, topic]) => (
          <a className="guide-card" href={`/guides/${slug}/`} key={slug}>
            <h2>{topic.title} <span aria-hidden="true">↗</span></h2>
            <p>{topic.summary}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
