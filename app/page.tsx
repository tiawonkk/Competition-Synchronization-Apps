import CompeteSyncApp from "@/components/CompeteSyncApp";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { StoreProvider } from "@/lib/store";

export default function Page() {
  return (
    <StoreProvider>
      <ConfirmProvider>
        <CompeteSyncApp />
      </ConfirmProvider>
    </StoreProvider>
  );
}
