import { useParams, useRouterState } from '@tanstack/react-router';
import AnimeDetailView from '@/components/AnimeDetailView';
import { useAuth } from '@/lib/auth';
import { getAnimeSearchReturnTo } from '@/lib/searchReturnTo';

export default function AnimeDetailPage() {
  const { malId } = useParams({ from: '/app/anime/$malId' });
  const { user } = useAuth();
  const returnToSearch = useRouterState({
    select: ({ location }) => getAnimeSearchReturnTo(location.state),
  });
  return (
    <AnimeDetailView
      key={`${user?.id ?? 'guest'}:${malId}`}
      malId={Number(malId)}
      returnToSearch={returnToSearch}
    />
  );
}
