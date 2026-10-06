export interface AgencyRow {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; clients: number };
}
