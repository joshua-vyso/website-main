import { WasteLog } from '@/components/platform/wastewatch/WasteLog';

export default async function WasteLogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <WasteLog initialCategory={category} />;
}
