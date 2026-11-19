import './site.css';
import Nav from './nav';

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
          <Nav />
        </header>
        {children}
        <footer className="site-footer">
          <span><strong>WardogsBuddy</strong> · Unofficial WARDOGS companion</span>
          <span>Not affiliated with the WARDOGS developers.</span>
        </footer>
      </body>
    </html>
  );
}
