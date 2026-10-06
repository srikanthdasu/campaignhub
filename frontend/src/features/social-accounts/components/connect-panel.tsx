import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelHeader } from './panel-header';

export function ConnectPanel({
  n,
  title,
  icon,
  color,
  description,
  buttonLabel,
  loading,
  disabled,
  onConnect,
}: {
  n: number;
  title: string;
  icon: LucideIcon;
  color: string;
  description: string;
  buttonLabel: string;
  loading: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  return (
    <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
      <PanelHeader n={n} title={title} icon={icon} color={color} />
      <p className="mb-3 text-xs text-neutral-400">{description}</p>
      <Button size="sm" className="w-full" loading={loading} disabled={disabled} onClick={onConnect}>
        {buttonLabel}
      </Button>
    </Card>
  );
}
