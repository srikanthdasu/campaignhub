'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Download } from 'lucide-react';

type ReportKey = 'content' | 'campaigns' | 'ads' | 'approvals';

const REPORTS: { key: ReportKey; label: string; description: string }[] = [
  { key: 'content', label: 'Content Report', description: 'Every content item, its type, platforms, and status.' },
  { key: 'campaigns', label: 'Campaign Report', description: 'Campaign goals, KPIs, platforms, and status.' },
  { key: 'ads', label: 'Ads Report', description: 'Paid campaigns, budget, and approval status.' },
  { key: 'approvals', label: 'Approval Report', description: 'Approval flows for this client and their outcome.' },
];

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-3xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Reports</h1>
        <p className="text-sm text-neutral-400">From data to decisions. Create. Customize. Share.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          Exports are CSV today (opens in Excel/Sheets) — PDF and PPT exports need a rendering
          pipeline not built in this pass. Every row is pulled live from CampaignHub&apos;s data.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

          {selectedClientId && <ReportList key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function ReportList({ clientId }: { clientId: string }) {
  const [generating, setGenerating] = useState<ReportKey | null>(null);
  const [preview, setPreview] = useState<{ key: ReportKey; rows: Record<string, unknown>[] } | null>(null);

  async function fetchRows(key: ReportKey): Promise<Record<string, unknown>[]> {
    if (key === 'content') {
      const items = await api.get<
        { id: string; type: string; status: string; platforms: string[]; createdAt: string }[]
      >(`/clients/${clientId}/content`);
      return items.map((i) => ({
        id: i.id,
        type: i.type,
        status: i.status,
        platforms: i.platforms.join(' / '),
        createdAt: new Date(i.createdAt).toLocaleString(),
      }));
    }
    if (key === 'campaigns') {
      const items = await api.get<
        { id: string; name: string; status: string; goal: string | null; kpi: string | null; target: number | null; platforms: string[] }[]
      >(`/clients/${clientId}/campaigns`);
      return items.map((c) => ({
        name: c.name,
        status: c.status,
        goal: c.goal ?? '',
        kpi: c.kpi ?? '',
        target: c.target ?? '',
        platforms: c.platforms.join(' / '),
      }));
    }
    if (key === 'ads') {
      const items = await api.get<
        { id: string; name: string; platform: string; status: string; budgetAmount: number | null; budgetCurrency: string }[]
      >(`/clients/${clientId}/ads`);
      return items.map((a) => ({
        name: a.name,
        platform: a.platform,
        status: a.status,
        budget: a.budgetAmount ? `${a.budgetCurrency} ${a.budgetAmount}` : '',
      }));
    }
    const flows = await api.get<
      { id: string; mode: string; status: string; createdAt: string; contentItem: { clientId: string; type: string } }[]
    >('/approvals');
    return flows
      .filter((f) => f.contentItem.clientId === clientId)
      .map((f) => ({
        id: f.id,
        contentType: f.contentItem.type,
        mode: f.mode,
        status: f.status,
        createdAt: new Date(f.createdAt).toLocaleString(),
      }));
  }

  async function onGenerate(key: ReportKey) {
    setGenerating(key);
    try {
      const rows = await fetchRows(key);
      setPreview({ key, rows });
    } finally {
      setGenerating(null);
    }
  }

  function onDownload() {
    if (!preview) return;
    download(`${preview.key}-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(preview.rows));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.key} padding="lg" className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-50">{r.label}</h3>
              <p className="mt-1 text-xs text-neutral-400">{r.description}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onGenerate(r.key)} loading={generating === r.key}>
              Generate
            </Button>
          </Card>
        ))}
      </div>

      {preview && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-50">
              {REPORTS.find((r) => r.key === preview.key)?.label} — {preview.rows.length} rows
            </h3>
            <Button size="sm" onClick={onDownload} disabled={preview.rows.length === 0}>
              <Download className="h-3.5 w-3.5" /> Download CSV
            </Button>
          </div>
          {preview.rows.length === 0 ? (
            <Card padding="lg">
              <p className="text-sm text-neutral-400">No rows for this report yet.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] uppercase tracking-wider text-neutral-500">
                  <tr>
                    {Object.keys(preview.rows[0]).map((h) => (
                      <th key={h} className="px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-3 py-2 text-neutral-300">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
