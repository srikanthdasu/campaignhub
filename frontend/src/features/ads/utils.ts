import type { Status } from './types';

export function maxReachable(status: Status): number {
  if (status === 'APPROVED' || status === 'LAUNCHED' || status === 'PAUSED' || status === 'COMPLETED') return 5;
  return 4;
}
