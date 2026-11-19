'use client';

import { usePathname } from 'next/navigation';

const links = [
  { href: '/xp-tracker/', label: 'XP Tracker' },
  { href: '/guides/', label: 'Guides' },
];

export default function Nav() {
  const pathname = usePathname() || '/';
  return (
    <nav aria-label="Main navigation">
      {links.map(({ href, label }) => (
        <a key={href} href={href} aria-current={pathname.startsWith(href.replace(/\/$/, '')) ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
