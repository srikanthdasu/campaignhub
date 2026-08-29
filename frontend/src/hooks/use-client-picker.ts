'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface ClientSummary {
  id: string;
  name: string;
}

export function useClientPicker() {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  useEffect(() => {
    api
      .get<ClientSummary[]>('/clients')
      .then((list) => {
        setClients(list);
        if (list.length > 0) setSelectedClientId((prev) => prev || list[0].id);
      })
      .catch(() => setClients([]));
  }, []);

  return { clients, selectedClientId, setSelectedClientId };
}
