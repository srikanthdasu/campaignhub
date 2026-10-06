export interface Overview {
  content: { byStatus: Record<string, number> };
  campaigns: { byStatus: Record<string, number> };
  ads: { byStatus: Record<string, number>; totalBudget: number };
  scheduledPosts: { byStatus: Record<string, number> };
  approvals: { total: number; pending: number; approved: number; rejected: number; avgResolutionHours: number | null };
  aiUsage: { conversations: number; captionsSaved: number; videoProjects: number; strategyRequests: number };
  socialAccounts: { total: number };
}
