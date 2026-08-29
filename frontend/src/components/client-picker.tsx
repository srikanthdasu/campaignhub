'use client';

import { Select } from '@/components/ui/select';
import type { ClientSummary } from '@/hooks/use-client-picker';

export function ClientPicker({
  clients,
  value,
  onChange,
}: {
  clients: ClientSummary[];
  value: string;
  onChange: (clientId: string) => void;
}) {
  return (
    <div className="max-w-xs">
      <Select label="Client" value={value} onChange={(e) => onChange(e.target.value)}>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
