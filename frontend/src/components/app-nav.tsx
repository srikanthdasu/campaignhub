'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, ROLE_LABELS, Role } from '@/lib/roles';

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
    <nav className="flex w-56 shrink-0 flex-col border-r border-neutral-200 p-4">
      <div className="mb-6">
        <p className="text-sm font-semibold">CampaignHub AI</p>
        {user && (
          <p className="text-xs text-neutral-500">
            {user.name} · {ROLE_LABELS[user.role as Role] ?? user.role}
          </p>
        )}
      </div>

      <ul className="flex-1 space-y-1">
        {links
          .filter((link) => !link.adminOnly || admin)
          .map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  pathname === link.href
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
      </ul>

      <button
        onClick={onLogout}
        className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        Sign out
      </button>
    </nav>
  );
}
