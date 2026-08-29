'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Settings as SettingsIcon,
  User as UserIcon,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, ROLE_LABELS, Role } from '@/lib/roles';
import { DURATION, EASE_SOFT, tapScale } from '@/lib/motion';

const links: { href: string; label: string; icon: LucideIcon; adminOnly: boolean }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/admin/agency', label: 'Agency & Clients', icon: Building2, adminOnly: true },
  { href: '/admin/members', label: 'Members', icon: Users, adminOnly: true },
  { href: '/admin/audit-log', label: 'Security & Audit', icon: ShieldCheck, adminOnly: true },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
  { href: '/profile', label: 'Profile', icon: UserIcon, adminOnly: false },
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
    <nav className="card-surface flex w-64 shrink-0 flex-col rounded-none border-y-0 border-l-0 p-5">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-neutral-900 to-accent-900 shadow-md shadow-accent-900/30">
          <Image src="/brand/emblem.png" alt="" width={28} height={27} className="h-7 w-auto" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-50">
            Campaign<span className="gradient-text">Hub AI</span>
          </p>
          <p className="truncate text-[11px] text-neutral-500">by Sreema</p>
        </div>
      </div>

      <ul className="flex-1 space-y-1">
        {links
          .filter((link) => !link.adminOnly || admin)
          .map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <li key={link.href} className="relative">
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    className="absolute inset-0 rounded-xl border border-accent-400/40 bg-accent-500/15 shadow-[0_0_20px_-4px_rgba(91,99,245,0.5)]"
                  />
                )}
                <Link
                  href={link.href}
                  className={`relative z-10 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'text-white' : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {link.label}
                </Link>
              </li>
            );
          })}
      </ul>

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="truncate text-xs font-medium text-neutral-200">{user?.name}</p>
        {user && (
          <p className="mb-3 truncate text-xs text-neutral-500">
            {ROLE_LABELS[user.role as Role] ?? user.role}
          </p>
        )}
        <motion.button
          whileTap={tapScale}
          whileHover={{ y: -1 }}
          transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-accent-500 to-fuchsia-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-accent-900/30 hover:shadow-lg hover:brightness-110"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Sign out
        </motion.button>
      </div>
    </nav>
  );
}
