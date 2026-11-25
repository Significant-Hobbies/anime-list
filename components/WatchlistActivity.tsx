import { useRef, useState } from 'react';
import { ApiError } from '@/lib/apiErrors';

interface RequestEntry {
  id: number;
  call: string;
  started: number;
  status: string;
  duration?: number;
}

export function useWatchlistActivity() {
  const sequence = useRef(0);
  const [entries, setEntries] = useState<RequestEntry[]>([]);

  async function track<T>(call: string, request: () => Promise<T>): Promise<T> {
    const id = ++sequence.current;
    const started = Date.now();
    setEntries((previous) => [{ id, call, started, status: 'Pending' }, ...previous].slice(0, 30));
    let status = 'Completed';
    try {
      return await request();
    } catch (error) {
      status =
        error instanceof ApiError
          ? `HTTP ${error.status}`
          : error instanceof DOMException && error.name === 'TimeoutError'
            ? 'Timed out'
            : error instanceof DOMException && error.name === 'AbortError'
              ? 'Canceled'
              : 'Failed';
      throw error;
    } finally {
      const duration = Date.now() - started;
      setEntries((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, status, duration } : entry))
      );
    }
  }

  return { entries, track };
}

export function WatchlistActivity({ entries }: { entries: RequestEntry[] }) {
  return (
    <details className="rounded-lg border border-border px-4 py-2 text-xs">
      <summary className="cursor-pointer font-medium">
        Watchlist API activity ({entries.length})
      </summary>
      <ul className="mt-2 divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
            <time className="text-muted-foreground">
              {new Date(entry.started).toLocaleTimeString()}
            </time>
            <code className="break-all">{entry.call}</code>
            <span>
              {entry.status}
              {entry.duration !== undefined && ` · ${entry.duration} ms`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
