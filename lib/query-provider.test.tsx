import { useQuery } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from './query-provider';

const session = vi.hoisted(() => ({ user: { id: 'alice' } as { id: string } | null }));
vi.mock('./auth', () => ({ useAuth: () => session }));
afterEach(cleanup);

function Detail() {
  const [draft] = useState(session.user?.id ?? 'guest');
  const { data } = useQuery({
    queryKey: ['anime', 'detail', 1],
    queryFn: async () => session.user?.id ?? 'guest',
  });
  return <div>{data ? `${data} detail; ${draft} draft` : 'Loading'}</div>;
}

it.each([false, true])('isolates account data and drafts (remount: %s)', async (remount) => {
  session.user = { id: 'alice' };
  const subtree = () => (
    <QueryProvider>
      <Detail />
    </QueryProvider>
  );
  let view = render(subtree());
  await screen.findByText('alice detail; alice draft');
  for (const account of ['bob', null]) {
    const previous = session.user?.id;
    session.user = account ? { id: account } : null;
    if (remount) {
      view.unmount();
      view = render(subtree());
    } else {
      view.rerender(subtree());
    }
    expect(screen.queryByText(new RegExp(`${previous} detail`))).not.toBeInTheDocument();
    const identity = account ?? 'guest';
    await screen.findByText(`${identity} detail; ${identity} draft`);
  }
});
