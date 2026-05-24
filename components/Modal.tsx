"use client";

import { useCallback, useRef, useEffect } from "react";
import type { MouseEventHandler } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function Modal({ children }: { children: React.ReactNode }) {
  const overlay = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const onClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (e.target === overlay.current) {
        if (onDismiss) onDismiss();
      }
    },
    [onDismiss, overlay]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      ref={overlay}
      className="fixed z-50 inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClick}
    >
      <div
        ref={wrapper}
        className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-lg shadow-lg flex flex-col"
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onDismiss}
            className="p-2 rounded-full bg-muted/50 hover:bg-muted"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
