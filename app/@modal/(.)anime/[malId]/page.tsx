import Modal from "@/components/Modal";
import AnimeDetailView from "@/components/AnimeDetailView";
import { notFound } from "next/navigation";

export default async function AnimeDetailModal({
    params,
  }: {
    params: Promise<{ malId: string }>;
  }) {
    const { malId } = await params;
    const numericMalId = Number(malId);

    if (!Number.isInteger(numericMalId) || numericMalId <= 0) {
      notFound();
    }
  
    return (
      <Modal>
        <AnimeDetailView malId={numericMalId} isModal={true} />
      </Modal>
    );
  }
