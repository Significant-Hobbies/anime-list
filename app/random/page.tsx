"use client";

import { useEffect, useState } from "react";
import { getRandomAnimePick } from "@/lib/api";

export default function RandomAnime() {
  const [msg, setMsg] = useState("Picking a random anime…");

  useEffect(() => {
    let aborted = false;
    getRandomAnimePick({ limit: 1 })
      .then((data) => {
        if (aborted) return;
        const pick = data.results[0];
        const id = pick?.mal_id ?? pick?.id;
        if (id != null) {
          window.location.replace(`/anime/${id}`);
        } else {
          setMsg("No anime available right now.");
        }
      })
      .catch(() => {
        if (!aborted) setMsg("Could not reach the catalog. Try again.");
      });
    return () => {
      aborted = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="font-mono text-sm text-muted-foreground">{msg}</p>
    </main>
  );
}
