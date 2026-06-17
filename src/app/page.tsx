import { DashboardClient } from "@/components/DashboardClient";
import { getLatestDashboardData } from "@/lib/dashboard-store";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function Home() {
  const data = await getLatestDashboardData();
  return <DashboardClient data={data} />;
}
