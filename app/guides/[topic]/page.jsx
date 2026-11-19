import { notFound } from 'next/navigation';
import { topics } from '../topics';

export function generateStaticParams() {
  return Object.keys(topics).map(topic => ({ topic }));
}

export async function generateMetadata({ params }) {
  const { topic } = await params;
  return { title: topics[topic]?.title };
}

export default async function GuidePage({ params }) {
  const { topic } = await params;
  const guide = topics[topic];
  if (!guide) notFound();

  return (
    <main className="guide-layout guide-article">
      <a className="back" href="/guides/">← All guides</a>
      <h1>{guide.title}</h1>
      {guide.sections.map(([title, content]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{content}</p>
        </section>
      ))}
      <a className="primary" href="/xp-tracker/">Open XP Tracker <span aria-hidden="true">↗</span></a>
    </main>
  );
}
