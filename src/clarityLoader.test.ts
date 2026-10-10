import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const loader = html.match(/<script>(\(function\(c,l,a,r,i\).*?)<\/script>/)?.[1];

function runLoader() {
  const listeners = new Map<string, () => void>();
  const insertBefore = vi.fn();
  const script = { parentNode: { insertBefore } };
  const setTimeout = vi.fn();
  const clearTimeout = vi.fn();
  const window = {
    clarity: undefined as undefined | { q: IArguments[] },
    addEventListener: vi.fn((event: string, callback: () => void) => {
      listeners.set(event, callback);
    }),
    removeEventListener: vi.fn((event: string) => {
      listeners.delete(event);
    }),
  };
  runInNewContext(loader ?? '', {
    window,
    document: {
      createElement: () => ({}),
      getElementsByTagName: () => [script],
    },
    setTimeout,
    clearTimeout,
  });
  return { window, listeners, insertBefore, setTimeout, clearTimeout };
}

describe('Clarity loader', () => {
  it('queues project metadata immediately without loading the third-party script', () => {
    expect(loader).toBeDefined();
    const { window, insertBefore, setTimeout } = runLoader();
    expect(typeof window.clarity).toBe('function');
    expect(Array.from(window.clarity?.q[0] ?? [])).toEqual(['set', 'project_id', 'anime-list']);
    expect(insertBefore).not.toHaveBeenCalled();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 90_000);
    expect(window.addEventListener).toHaveBeenCalledTimes(4);
    expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
      once: true,
    });
  });

  it.each(['pointerdown', 'keydown', 'touchstart', 'scroll'])(
    'loads once on %s and removes all interaction listeners',
    (event) => {
      const { listeners, insertBefore, setTimeout, clearTimeout } = runLoader();
      const trigger = listeners.get(event);
      trigger?.();
      trigger?.();
      setTimeout.mock.calls[0][0]();
      expect(insertBefore).toHaveBeenCalledOnce();
      expect(insertBefore.mock.calls[0][0]).toEqual({
        async: 1,
        src: 'https://www.clarity.ms/tag/y6bu7b62ia',
      });
      expect(listeners.size).toBe(0);
      expect(clearTimeout).toHaveBeenCalledOnce();
    }
  );

  it('loads after 30 seconds without interaction', () => {
    const { listeners, insertBefore, setTimeout } = runLoader();
    setTimeout.mock.calls[0][0]();
    expect(insertBefore).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });
});
