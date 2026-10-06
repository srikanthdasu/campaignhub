export type ReportKey = 'content' | 'campaigns' | 'ads' | 'approvals';
export type ReportTableRow = Record<string, unknown> & { __rowIndex: number };

export const REPORTS: { key: ReportKey; label: string; description: string }[] = [
  { key: 'content', label: 'Content Report', description: 'Every content item, its type, platforms, and status.' },
  { key: 'campaigns', label: 'Campaign Report', description: 'Campaign goals, KPIs, platforms, and status.' },
  { key: 'ads', label: 'Ads Report', description: 'Paid campaigns, budget, and approval status.' },
  { key: 'approvals', label: 'Approval Report', description: 'Approval flows for this client and their outcome.' },
];
