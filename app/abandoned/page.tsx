import { fetchAbandonedData } from "@/lib/abandoned-data";
import AbandonedView from "@/components/AbandonedView";

export const dynamic = "force-dynamic";

export default async function AbandonedPage() {
  const data = await fetchAbandonedData();

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px" }}>
      <AbandonedView data={data} />
    </main>
  );
}
