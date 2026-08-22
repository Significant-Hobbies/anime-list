import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { getRandomAnimePick } from '@/lib/api';

export default function GenreRandomPage() {
  const { genre } = useParams({ from: '/app/genre/$genre' });
  const [msg, setMsg] = useState('Picking a random anime in this genre…');

  useEffect(() => {
    if (!genre) {
      setMsg('Missing genre.');
      return;
    }
    let aborted = false;
    getRandomAnimePick({ genre, limit: 1 })
      .then((data) => {
        if (aborted) return;
        const pick = data.results[0];
        const id = pick?.mal_id ?? pick?.id;
        if (id != null) {
          window.location.replace(`/anime/${id}`);
        } else {
          setMsg(`No anime found in ${decodeURIComponent(genre)}.`);
        }
      })
      .catch(() => {
        if (!aborted) setMsg('Could not reach the catalog. Try again.');
      });
    return () => {
      aborted = true;
    };
  }, [genre]);

  return (
    <div
      aria-live="polite"
      className="flex min-h-screen items-center justify-center p-8"
      role="status"
    >
      <p className="font-mono text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}
