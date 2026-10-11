import { useParams } from '@tanstack/react-router';
import RandomAnimeRedirect from '@/components/RandomAnimeRedirect';

export default function GenreRandomPage() {
  const { genre } = useParams({ from: '/app/genre/$genre' });
  return <RandomAnimeRedirect genre={genre} />;
}
