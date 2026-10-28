import CompeteSyncApp from "@/components/CompeteSyncApp";
import { StoreProvider } from "@/lib/store";

export default function Page() {
  return (
    <StoreProvider>
      <CompeteSyncApp />
    </StoreProvider>
  );
}
