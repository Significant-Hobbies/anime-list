'use client';

import { FeedbackWidget, type FeedbackSubmission } from '@saas-maker/feedback';
import '@saas-maker/feedback/dist/index.css';
import { useAuth } from '@/lib/auth';
import { useEffect, useRef } from 'react';

const API_BASE = 'https://api.sassmaker.com';
const PROJECT_KEY =
  import.meta.env.VITE_SAASMAKER_API_KEY || 'pk_cc65b4b8b85dd706a20d61938e539e79bcd576f91bbbf1c5';

async function submitToHostedService(submission: FeedbackSubmission): Promise<void> {
  let imageUrl: string | undefined;
  if (submission.screenshot) {
    const upload = new FormData();
    upload.append('file', submission.screenshot);
    const uploaded = await fetch(`${API_BASE}/v1/upload`, {
      method: 'POST',
      headers: { 'X-Project-Key': PROJECT_KEY },
      credentials: 'omit',
      body: upload,
    });
    if (!uploaded.ok) {
      throw new Error(`Feedback image upload returned HTTP ${uploaded.status}.`);
    }
    const result = (await uploaded.json()) as { url?: string };
    imageUrl = result.url;
  }

  const response = await fetch(`${API_BASE}/v1/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Project-Key': PROJECT_KEY,
    },
    credentials: 'omit',
    body: JSON.stringify({
      type: submission.type,
      title: submission.title,
      description: submission.description,
      submitter_email: submission.email ?? '',
      submitter_name: submission.name,
      image_url: imageUrl,
      page: submission.page,
      anchor: submission.anchor,
      source: 'widget',
    }),
  });
  if (!response.ok) {
    throw new Error(`Feedback service returned HTTP ${response.status}.`);
  }
}

export default function FeedbackWidgetWrapper() {
  const { user } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let dialog: HTMLElement | null = null;
    let trigger: HTMLButtonElement | null = null;

    const focusable = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? [];

    const containFocus = (event: KeyboardEvent) => {
      if (!dialog || event.key !== 'Tab') return;
      const items = Array.from(focusable()).filter((item) => {
        const style = window.getComputedStyle(item);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === dialog ||
          document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(() => {
      const nextDialog = host.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (nextDialog && nextDialog !== dialog) {
        dialog = nextDialog;
        trigger = host.querySelector<HTMLButtonElement>('.smw-trigger');
        dialog.tabIndex = -1;
        dialog.addEventListener('keydown', containFocus);
        dialog.focus();
      } else if (!nextDialog && dialog) {
        dialog.removeEventListener('keydown', containFocus);
        dialog = null;
        trigger?.focus();
        trigger = null;
      }
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      dialog?.removeEventListener('keydown', containFocus);
    };
  }, []);

  return (
    <div ref={hostRef}>
      <FeedbackWidget
        onSubmit={submitToHostedService}
        userEmail={user?.email}
        userName={user?.name}
      />
    </div>
  );
}
