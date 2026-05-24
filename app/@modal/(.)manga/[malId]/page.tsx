import Modal from "@/components/Modal";
import MangaDetailView from "@/components/MangaDetailView";
import { notFound } from "next/navigation";

export default async function MangaDetailModal({
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
        <MangaDetailView malId={numericMalId} isModal={true} />
      </Modal>
    );
  }
