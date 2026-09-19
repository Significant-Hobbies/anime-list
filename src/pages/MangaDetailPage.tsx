import { useParams } from '@tanstack/react-router';
import MangaDetailView from '@/components/MangaDetailView';
import { useAuth } from '@/lib/auth';

export default function MangaDetailPage() {
  const { malId } = useParams({ from: '/app/manga/$malId' });
  const { user } = useAuth();
  return <MangaDetailView key={`${user?.id ?? 'guest'}:${malId}`} malId={Number(malId)} />;
}
