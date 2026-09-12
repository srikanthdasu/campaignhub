'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  size?: 'sm' | 'xs';
  className?: string;
}

export function Table<T>({ columns, rows, rowKey, size = 'sm', className }: TableProps<T>) {
  const cellPadding = size === 'xs' ? 'px-3 py-2' : 'px-4 py-2.5';
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-white/10', className)}>
      <table className={cn('w-full text-left', size === 'xs' ? 'text-xs' : 'text-sm')}>
        <thead className="bg-white/[0.03] uppercase tracking-wider text-neutral-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cellPadding}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-white/5">
              {columns.map((col) => (
                <td key={col.key} className={cn(cellPadding, 'text-neutral-300', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
