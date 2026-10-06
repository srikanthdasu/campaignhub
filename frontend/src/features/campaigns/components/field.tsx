import { useState } from 'react';

export function Field({
  label,
  value,
  onSave,
  type = 'text',
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  type?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? '');
  }

  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-neutral-400">{label}</label>
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== (value ?? '') && onSave(draft)}
        className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-50 outline-none focus:border-accent-400"
      />
    </div>
  );
}
