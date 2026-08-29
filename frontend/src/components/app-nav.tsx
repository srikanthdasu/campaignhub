'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, ROLE_LABELS, Role } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { DURATION, EASE_SOFT } from '@/lib/motion';

const links = [
  { href: '/dashboard', label: 'Dashboard', adminOnly: false },
  { href: '/admin/agency', label: 'Agency & Clients', adminOnly: true },
  { href: '/admin/members', label: 'Members', adminOnly: true },
  { href: '/admin/audit-log', label: 'Security & Audit', adminOnly: true },
  { href: '/settings', label: 'Settings', adminOnly: true },
  { href: '/profile', label: 'Profile', adminOnly: false },
];

export function AppNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const admin = isAgencyAdmin(user?.role as Role | undefined);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <nav className="card-surface flex w-60 shrink-0 flex-col rounded-none border-y-0 border-l-0 p-5">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neutral-900 to-accent-900 shadow-md shadow-accent-900/20">
          <Image src="/brand/emblem.png" alt="" width={28} height={27} className="h-7 w-auto" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            CampaignHub AI
          </p>
          <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">by Sreema</p>
        </div>
      </div>

      <ul className="flex-1 space-y-1">
        {links
          .filter((link) => !link.adminOnly || admin)
          .map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href} className="relative">
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-b from-accent-500 to-accent-600 shadow-md shadow-accent-900/20"
                  />
                )}
                <Link
                  href={link.href}
                  className={`relative z-10 block rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
      </ul>

      <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {user?.name}
        </p>
        {user && (
          <p className="mb-2 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {ROLE_LABELS[user.role as Role] ?? user.role}
          </p>
        )}
        <Button variant="secondary" size="sm" onClick={onLogout} className="mt-2 w-full">
          Sign out
        </Button>
      </div>
    </nav>
  );
}
