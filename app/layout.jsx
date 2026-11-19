import './site.css';

export const metadata = {
  title: { default: 'WardogsBuddy', template: '%s | WardogsBuddy' },
  description: 'Track your WARDOGS class XP and plan your next session.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="wordmark" href="/">WARDOGS<span>BUDDY</span></a>
          <nav aria-label="Main navigation">
            <a href="/xp-tracker/">XP Tracker</a>
            <a href="/guides/">Guides</a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">WardogsBuddy · Unofficial WARDOGS companion</footer>
      </body>
    </html>
  );
}
