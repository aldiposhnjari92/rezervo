import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { OwnerShell } from "./shell";

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
      {children}
    </OwnerShell>
  );
}
