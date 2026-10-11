import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useResourceQuery } from './use-resource-query';

vi.mock('./auth', () => ({ useAuth: () => ({ user: null }) }));
afterEach(cleanup);

function setup(
  fetcher: (signal: AbortSignal) => Promise<string[]>,
  enabled = true,
  queryKey = ['resource-test']
) {
  const client = new QueryClient();
  function View() {
    const resource = useResourceQuery({
      queryKey,
      queryFn: ({ signal }) => fetcher(signal),
      enabled,
    });
    return (
      <div>
        <span>{resource.status}</span>
        <span>{resource.data?.join(',')}</span>
        {resource.isRevalidating && <span>updating</span>}
        <button
          onClick={() => {
            void resource.retry();
          }}
        >
          try again
        </button>
      </div>
    );
  }
  const tree = (visible = true) => (
    <QueryClientProvider client={client}>{visible && <View />}</QueryClientProvider>
  );
  return { client, tree, View };
}

it('renders loading immediately and cached data synchronously on a revisit', async () => {
  let resolve: (data: string[]) => void = () => {};
  const fetcher = vi.fn(
    () =>
      new Promise<string[]>((done) => {
        resolve = done;
      })
  );
  const { tree } = setup(fetcher);
  const view = render(tree());
  expect(screen.getByText('loading')).toBeInTheDocument();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await act(async () => {
    resolve(['cached title']);
  });
  view.rerender(tree(false));
  view.rerender(tree());
  expect(screen.getByText('cached title')).toBeInTheDocument();
  expect(screen.queryByText('loading')).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps cached content during invalidation and propagates optimistic edits', async () => {
  let resolve: (data: string[]) => void = () => {};
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(['old title'])
    .mockImplementation(
      () =>
        new Promise<string[]>((done) => {
          resolve = done;
        })
    );
  const { client, tree } = setup(fetcher);
  render(tree());
  await screen.findByText('old title');
  act(() => {
    void client.invalidateQueries({ queryKey: ['resource-test'] });
  });
  expect(screen.getByText('old title')).toBeInTheDocument();
  await screen.findByText('updating');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolve(['fresh title']);
  });
  await screen.findByText('fresh title');
  act(() => {
    client.setQueryData(['resource-test'], ['optimistic title']);
  });
  expect(screen.getByText('optimistic title')).toBeInTheDocument();
});

it('distinguishes empty success from an error and allows a manual retry without retrying 4xx', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
    .mockResolvedValueOnce([]);
  const { tree } = setup(fetcher);
  render(tree());
  await screen.findByText('error');
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'try again' }));
  await screen.findByText('empty');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([new TypeError('offline'), Object.assign(new Error('unavailable'), { status: 503 })])(
  'retries transient failures with backoff',
  async (error) => {
    const fetcher = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(['recovered']);
    const { tree } = setup(fetcher);
    render(tree());
    await screen.findByText('recovered', {}, { timeout: 2500 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  }
);

it('aborts a pending read when its last subscriber leaves', async () => {
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn((received: AbortSignal) => {
    signal = received;
    return new Promise<string[]>(() => {});
  });
  const { tree } = setup(fetcher);
  const view = render(tree());
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  view.unmount();
  expect(signal?.aborted).toBe(true);
});

it('does not fetch disabled account reads', async () => {
  const fetcher = vi.fn().mockResolvedValue([]);
  const { tree } = setup(fetcher, false);
  render(tree());
  await act(async () => {});
  expect(fetcher).not.toHaveBeenCalled();
});

it('cancels a read started before a mutation and fetches the post-mutation value', async () => {
  let oldSignal: AbortSignal | undefined;
  let resolveOld: (data: string[]) => void = () => {};
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(['initial title'])
    .mockImplementationOnce((signal: AbortSignal) => {
      oldSignal = signal;
      return new Promise<string[]>((resolve) => {
        resolveOld = resolve;
      });
    })
    .mockResolvedValueOnce(['post-mutation title']);
  const { client, tree } = setup(fetcher);
  render(tree());
  await screen.findByText('initial title');
  act(() => {
    void client.invalidateQueries({ queryKey: ['resource-test'] });
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  act(() => {
    void client.invalidateQueries({ queryKey: ['resource-test'] });
  });
  expect(oldSignal?.aborted).toBe(true);
  await screen.findByText('post-mutation title');
  await act(async () => {
    resolveOld(['stale title']);
  });
  expect(screen.getByText('post-mutation title')).toBeInTheDocument();
  expect(screen.queryByText('stale title')).not.toBeInTheDocument();
});

it('keeps public route data cached when the app provider remounts', async () => {
  const fetcher = vi.fn().mockResolvedValue(['public cached title']);
  const key = ['stats', 'public-revisit-test'];
  const first = setup(fetcher, true, key);
  const view = render(first.tree());
  await screen.findByText('public cached title');
  view.unmount();
  const second = setup(fetcher, true, key);
  render(second.tree());
  expect(screen.getByText('public cached title')).toBeInTheDocument();
  expect(screen.queryByText('loading')).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(second.client.getQueryData(key)).toEqual(['public cached title']);
});

it('deduplicates concurrent subscribers and cancels only after the last one leaves', async () => {
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn((received: AbortSignal) => {
    signal = received;
    return new Promise<string[]>(() => {});
  });
  const { client, View } = setup(fetcher);
  const tree = (both: boolean) => (
    <QueryClientProvider client={client}>
      <View />
      {both && <View />}
    </QueryClientProvider>
  );
  const view = render(tree(true));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  view.rerender(tree(false));
  expect(signal?.aborted).toBe(false);
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
