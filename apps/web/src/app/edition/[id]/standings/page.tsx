'use client';

import { useParams } from 'next/navigation';
import { EditionStandingsPanel } from '@/components/standings/EditionStandingsPanel';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

export default function StandingsPage() {
  const { id: editionId } = useParams<{ id: string }>();

  return (
    <>
      <EditionStandingsPanel editionId={editionId} variant="page" />
      <MobileBottomNav />
    </>
  );
}
