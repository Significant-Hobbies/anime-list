import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MangaDetailView from "@/components/MangaDetailView";

type MangaDetailPageProps = {
  params: Promise<{
    malId: string;
  }>;
};

export async function generateMetadata({
  params,
}: MangaDetailPageProps): Promise<Metadata> {
  const { malId } = await params;

  return {
    title: `Manga ${malId}`,
  };
}

export default async function MangaDetailPage({
  params,
}: MangaDetailPageProps) {
  const { malId } = await params;
  const numericMalId = Number(malId);

  if (!Number.isInteger(numericMalId) || numericMalId <= 0) {
    notFound();
  }

  return <MangaDetailView malId={numericMalId} />;
}
