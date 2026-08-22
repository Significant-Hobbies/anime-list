'use client';

import { FeedbackWidget, type FeedbackSubmission } from '@saas-maker/feedback';
import '@saas-maker/feedback/dist/index.css';
import { useAuth } from '@/lib/auth';

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

  return (
    <FeedbackWidget
      onSubmit={submitToHostedService}
      userEmail={user?.email}
      userName={user?.name}
    />
  );
}
