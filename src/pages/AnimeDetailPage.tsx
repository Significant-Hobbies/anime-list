import { useParams } from '@tanstack/react-router';
import AnimeDetailView from '@/components/AnimeDetailView';
import { useAuth } from '@/lib/auth';

export default function AnimeDetailPage() {
  const { malId } = useParams({ from: '/app/anime/$malId' });
  const { user } = useAuth();
  return <AnimeDetailView key={`${user?.id ?? 'guest'}:${malId}`} malId={Number(malId)} />;
}
