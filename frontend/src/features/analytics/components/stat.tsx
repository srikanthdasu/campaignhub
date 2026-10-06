export function Stat({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={small ? 'mt-1 text-lg font-semibold text-neutral-100' : 'mt-1 text-2xl font-bold text-neutral-50'}>
        {value}
      </p>
    </div>
  );
}
