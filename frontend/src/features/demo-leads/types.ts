export interface DemoLead {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface DemoLeadsResponse {
  items: DemoLead[];
  total: number;
}
