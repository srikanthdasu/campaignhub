import { UserPlus, PenSquare, Share2, ClipboardCheck, CalendarPlus, Rocket } from 'lucide-react';

export interface Agency {
  id: string;
  name: string;
  plan: string;
}

export interface Overview {
  totalClients: number;
  connectedAccounts: number;
  posts: {
    drafts: number;
    pendingApproval: number;
    approved: number;
    scheduled: number;
    published: number;
    failed: number;
    rejected: number;
  };
  postsByPlatform: Record<string, number>;
  upcomingScheduledPosts: {
    id: string;
    platform: string;
    scheduledTime: string;
    body: string | null;
    type: string;
    clientName: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    actorName: string | null;
  }[];
}

export interface Subscription {
  plan: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
}

export const REAL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'WHATSAPP'];

export const POST_STATUS_META: { key: keyof Overview['posts']; label: string; color: string }[] = [
  { key: 'drafts', label: 'Drafts', color: '#a1a1aa' },
  { key: 'pendingApproval', label: 'Pending Approval', color: '#f59e0b' },
  { key: 'approved', label: 'Approved', color: '#22c55e' },
  { key: 'scheduled', label: 'Scheduled', color: '#0ea5e9' },
  { key: 'published', label: 'Published', color: '#8b5cf6' },
  { key: 'failed', label: 'Failed', color: '#ef4444' },
];

export const WORKFLOW_STEPS = [
  { n: 1, title: 'Add Client', icon: UserPlus, color: '#6366f1', href: '/admin/agency' },
  { n: 2, title: 'Create Content', icon: PenSquare, color: '#8b5cf6', href: '/content-planner' },
  { n: 3, title: 'Connect Accounts', icon: Share2, color: '#0ea5e9', href: '/social-accounts' },
  { n: 4, title: 'Get Approval', icon: ClipboardCheck, color: '#f59e0b', href: '/approvals' },
  { n: 5, title: 'Schedule', icon: CalendarPlus, color: '#22c55e', href: '/scheduler' },
  { n: 6, title: 'Publish', icon: Rocket, color: '#d946ef', href: '/scheduler' },
];
