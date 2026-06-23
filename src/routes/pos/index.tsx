import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { POSKasir } from "@frontend/components/pos-kasir";
import { getStoreSettings } from "@backend/server-actions";

export const Route = createFileRoute("/pos/")({
  component: PosPage,
  loader: async () => {
    const result = await getStoreSettings();
    return { storeName: result.settings?.store_name ?? "FILKOM Merch" };
  },
  head: () => ({ meta: [{ title: "Kasir POS — FILKOM Merch" }] }),
});

function PosPage() {
  const { user } = useAuth();
  const { storeName } = Route.useLoaderData();

  if (!user || user.type !== "admin") return null;

  return (
    <POSKasir
      admin_id={user.id ?? 1}
      admin_name={user.username}
      store_name={storeName}
    />
  );
}
