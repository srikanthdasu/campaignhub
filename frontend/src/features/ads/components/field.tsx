import { useState } from 'react';

export function Field({
  label,
  value,
  onSave,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? '');
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</label>
      <input
        type={type}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== (value ?? '') && onSave(draft)}
        className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none focus:border-accent-400 disabled:opacity-50"
      />
    </div>
  );
}
