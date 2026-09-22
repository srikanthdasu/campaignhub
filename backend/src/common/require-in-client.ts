import { NotFoundException } from '@nestjs/common';

// The same tenant-ownership check — fetch by id, confirm it actually belongs to clientId, 404
// otherwise — was copy-pasted near-identically across 9 service files, differing only by which
// Prisma model and what label went in the error message. One shared implementation means a
// future fix to this logic only needs to happen once, not in 9 places that could drift apart.
export async function requireInClient<T extends { clientId: string } | null>(
  finder: () => Promise<T>,
  clientId: string,
  entityLabel: string,
): Promise<NonNullable<T>> {
  const entity = await finder();
  if (!entity || entity.clientId !== clientId) {
    throw new NotFoundException(`${entityLabel} not found for this client`);
  }
  return entity as NonNullable<T>;
}
