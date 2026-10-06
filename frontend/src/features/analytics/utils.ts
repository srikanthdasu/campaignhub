export function sum(byStatus: Record<string, number>): number {
  return Object.values(byStatus).reduce((a, b) => a + b, 0);
}
