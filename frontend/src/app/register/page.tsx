'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, ApiError } from '@/contexts/auth-context';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(agencyName, name, email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Create your agency</h1>
          <p className="text-sm text-neutral-500">
            You&apos;ll be the Owner of this agency workspace.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Field label="Agency name" id="agencyName" value={agencyName} onChange={setAgencyName} />
        <Field label="Your name" id="name" value={name} onChange={setName} />
        <Field label="Email" id="email" type="email" value={email} onChange={setEmail} />
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <p className="text-xs text-neutral-500">At least 10 characters.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create agency'}
        </button>

        <p className="text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-neutral-900 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
      />
    </div>
  );
}
