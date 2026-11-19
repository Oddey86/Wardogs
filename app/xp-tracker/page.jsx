import Script from 'next/script';
import { trackerMarkup } from './tracker-markup';
import './tracker.css';

export const metadata = { title: 'XP Tracker' };

export default function TrackerPage() {
  return (
    <>
      <div className="tracker-view" dangerouslySetInnerHTML={{ __html: trackerMarkup }} />
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js" />
      <Script src="/xp-tracker.js" />
    </>
  );
}
