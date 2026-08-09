import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { OwnerShell } from "./shell";
import { SuspendedBanner } from "./suspended-banner";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { business } = await requireBusiness();
  const admin = await isPlatformAdmin();

  return (
    <OwnerShell
      businessId={business.id}
      businessName={business.name}
      slug={business.slug}
      isAdmin={admin}
    >
      {business.suspended_at && (
        <SuspendedBanner
          suspendedAt={business.suspended_at}
          reason={business.suspended_reason}
        />
      )}
      {children}
    </OwnerShell>
  );
}
