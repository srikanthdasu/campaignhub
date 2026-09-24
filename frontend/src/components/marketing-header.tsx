import Link from 'next/link';
import Image from 'next/image';

const NAV_LINKS = [
  { href: '/blog', label: 'Blog' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/book-demo', label: 'Book a demo' },
];

export function MarketingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/brand/emblem.png" alt="" width={32} height={32} />
        <span className="text-lg font-semibold text-neutral-50">CampaignHub AI</span>
      </Link>
      <nav className="hidden items-center gap-6 md:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-neutral-400 hover:text-neutral-50"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm font-medium text-neutral-300 hover:text-neutral-50">
          Sign in
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent-400 via-accent-500 to-fuchsia-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-accent-900/30 hover:shadow-lg hover:brightness-110"
        >
          Start free
        </Link>
      </div>
    </header>
  );
}
