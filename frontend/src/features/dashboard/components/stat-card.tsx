import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';

export function StatCard({ label, value, error = false }: { label: string; value: number | null; error?: boolean }) {
  return (
    <Card padding="lg" hoverable>
      <p className="text-xs text-neutral-400">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-neutral-50 sm:text-3xl">
        {error ? (
          <span className="text-base font-normal text-neutral-500" title="Couldn't load — try refreshing">
            —
          </span>
        ) : value === null ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <AnimatedNumber value={value} />
        )}
      </div>
    </Card>
  );
}
