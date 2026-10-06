import { DELETE_GRACE_DAYS } from './types';
import type { Client, DetailsForm } from './types';

export function daysLeft(deletedAt: string): number {
  const purgeAt = new Date(deletedAt).getTime() + DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function generatePassword(): string {
  // Excludes visually ambiguous characters (0/O, 1/l/I) since this gets read and typed by a
  // human off-screen — length comfortably clears the backend's 10-character minimum.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export function toDetailsForm(client: Client): DetailsForm {
  return {
    businessType: client.businessType ?? '',
    industry: client.industry ?? '',
    address: client.address ?? '',
    timeZone: client.timeZone ?? '',
    currency: client.currency ?? '',
    defaultLanguage: client.defaultLanguage ?? '',
    allowClientPortalAccess: client.allowClientPortalAccess,
    allowClientContentCreation: client.allowClientContentCreation,
    notes: client.notes ?? '',
    plan: client.plan,
    status: client.status,
  };
}

export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
