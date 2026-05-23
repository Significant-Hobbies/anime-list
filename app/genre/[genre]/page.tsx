"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRandomAnimePick } from "@/lib/api";

export default function GenreRandomPage() {
  const params = useParams<{ genre: string }>();
  const [msg, setMsg] = useState("Picking a random anime in this genre…");

  useEffect(() => {
    const genre = params?.genre;
    if (!genre) {
      setMsg("Missing genre.");
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
        if (!aborted) setMsg("Could not reach the catalog. Try again.");
      });
    return () => {
      aborted = true;
    };
  }, [params?.genre]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="font-mono text-sm text-muted-foreground">{msg}</p>
    </main>
  );
}
