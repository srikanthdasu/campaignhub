'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { DURATION, EASE_SOFT } from '@/lib/motion';
import { Download } from 'lucide-react';
import type { ReportKey, ReportTableRow } from './types';
import { REPORTS } from './types';
import { fetchContentReport, fetchCampaignsReport, fetchAdsReport, fetchApprovalsReport } from './api/reports-api';
import { toCsv, download } from './utils';

export function ReportList({ clientId }: { clientId: string }) {
  const [generating, setGenerating] = useState<ReportKey | null>(null);
  const [preview, setPreview] = useState<{ key: ReportKey; rows: Record<string, unknown>[] } | null>(null);

  async function fetchRows(key: ReportKey): Promise<Record<string, unknown>[]> {
    if (key === 'content') {
      const items = await fetchContentReport(clientId);
      return items.map((i) => ({
        id: i.id,
        type: i.type,
        status: i.status,
        platforms: i.platforms.join(' / '),
        createdAt: new Date(i.createdAt).toLocaleString(),
      }));
    }
    if (key === 'campaigns') {
      const items = await fetchCampaignsReport(clientId);
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
      const items = await fetchAdsReport(clientId);
      return items.map((a) => ({
        name: a.name,
        platform: a.platform,
        status: a.status,
        budget: a.budgetAmount ? `${a.budgetCurrency} ${a.budgetAmount}` : '',
      }));
    }
    const flows = await fetchApprovalsReport();
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
            <Table
              size="xs"
              rows={preview.rows.map((row, i) => ({ ...row, __rowIndex: i }))}
              rowKey={(row) => String(row.__rowIndex)}
              columns={Object.keys(preview.rows[0]).map((h) => ({
                key: h,
                header: h,
                render: (row: ReportTableRow) => String(row[h]),
              }))}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
