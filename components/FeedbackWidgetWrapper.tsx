'use client';

import { FeedbackWidget } from '@saas-maker/feedback';
import '@saas-maker/feedback/dist/index.css';
import { useAuth } from '@/lib/auth';

const API_BASE = 'https://api.sassmaker.com';
const PROJECT_KEY =
  import.meta.env.VITE_SAASMAKER_API_KEY || 'pk_cc65b4b8b85dd706a20d61938e539e79bcd576f91bbbf1c5';

export default function FeedbackWidgetWrapper() {
  const { user } = useAuth();

  return (
    <FeedbackWidget
      projectKey={PROJECT_KEY}
      apiBaseUrl={API_BASE}
      userEmail={user?.email}
      userName={user?.name}
    />
  );
}
