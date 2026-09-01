'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Settings as SettingsIcon,
  User as UserIcon,
  LogOut,
  CalendarClock,
  Image as ImageIcon,
  ClipboardCheck,
  CheckSquare,
  Share2,
  Inbox,
  Bot,
  Sparkles,
  Video,
  Brain,
  Megaphone,
  Rocket,
  BarChart3,
  FileText,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, ROLE_LABELS, Role } from '@/lib/roles';
import { DURATION, EASE_SOFT, tapScale } from '@/lib/motion';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
}

const sections: { label: string; links: NavLink[] }[] = [
  {
    label: 'Workspace',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
      { href: '/admin/agency', label: 'Agency & Clients', icon: Building2, adminOnly: true },
      { href: '/content-planner', label: 'Content Planner', icon: ClipboardCheck, adminOnly: false },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone, adminOnly: false },
      { href: '/ads', label: 'Ads & Paid Campaigns', icon: Rocket, adminOnly: false },
      { href: '/media-library', label: 'Media Library', icon: ImageIcon, adminOnly: false },
      { href: '/scheduler', label: 'Scheduler', icon: CalendarClock, adminOnly: false },
      {
        href: '/social-accounts',
        label: 'Social Accounts',
        icon: Share2,
        adminOnly: false,
      },
    ],
  },
  {
    label: 'AI Studio',
    links: [
      { href: '/ai-assistant', label: 'AI Assistant', icon: Bot, adminOnly: false },
      { href: '/ai-captions', label: 'AI Captions', icon: Sparkles, adminOnly: false },
      { href: '/ai-video-studio', label: 'AI Video Studio', icon: Video, adminOnly: false },
    ],
  },
  {
    label: 'Engagement',
    links: [
      { href: '/unified-inbox', label: 'Unified Inbox', icon: Inbox, adminOnly: false },
      { href: '/approvals', label: 'Approvals', icon: CheckSquare, adminOnly: false },
    ],
  },
  {
    label: 'Insights',
    links: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: false },
      { href: '/reports', label: 'Reports', icon: FileText, adminOnly: false },
    ],
  },
  {
    label: 'Business',
    links: [
      { href: '/admin/members', label: 'Members', icon: Users, adminOnly: true },
      { href: '/ai-strategy', label: 'AI Strategy & Governance', icon: Brain, adminOnly: false },
      { href: '/billing', label: 'Billing & Subscriptions', icon: CreditCard, adminOnly: true },
      { href: '/admin/audit-log', label: 'Security & Audit', icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    label: 'System',
    links: [
      { href: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
      { href: '/profile', label: 'Profile', icon: UserIcon, adminOnly: false },
    ],
  },
];

// A Client-role user gets their own portal only — not the agency's full workspace, per the
// book's Client Portal result: "A client sees only their own campaigns, approvals, analytics,
// social status and subscription."
const clientSections: { label: string; links: NavLink[] }[] = [
  {
    label: 'Client Portal',
    links: [
      { href: '/client-portal', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
      { href: '/approvals', label: 'Approvals', icon: CheckSquare, adminOnly: false },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: false },
    ],
  },
  {
    label: 'System',
    links: [{ href: '/profile', label: 'Profile', icon: UserIcon, adminOnly: false }],
  },
];

export function AppNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const admin = isAgencyAdmin(user?.role as Role | undefined);
  const isClient = user?.role === 'CLIENT';
  const navSections = isClient ? clientSections : sections;
  const activeLinkRef = useRef<HTMLLIElement>(null);

  // The sidebar scrolls independently of the page and can be taller than the viewport (System
  // Health, AI Studio, etc. push Insights/Business further down) — without this, navigating to
  // a link near the bottom leaves its highlight scrolled out of view, so it looks like nothing
  // is selected even though the route did change.
  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <nav className="card-surface flex w-64 shrink-0 flex-col overflow-y-auto rounded-none border-y-0 border-l-0 p-5">
      <div className="mb-8">
        <Image
          src="/brand/logo-wide.png"
          alt="CampaignHub AI by Sreema"
          width={920}
          height={299}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="flex-1 space-y-5">
        {navSections.map((section) => {
          const visibleLinks = section.links.filter((link) => !link.adminOnly || admin);
          if (visibleLinks.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="mb-1.5 px-3.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                {section.label}
              </p>
              <ul className="space-y-1">
                {visibleLinks.map((link) => {
                  const active = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <li key={link.href} ref={active ? activeLinkRef : undefined} className="relative">
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
                          active
                            ? 'text-white'
                            : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

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
