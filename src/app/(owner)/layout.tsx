import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { OwnerShell } from "./shell";
import { SuspendedBanner } from "./suspended-banner";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  const admin = await isPlatformAdmin();

  // Google i jep këto te user_metadata; me email/fjalëkalim mungojnë dhe
  // avatari bie te inicialet.
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof metadata.full_name === "string" ? metadata.full_name : null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  return (
    <OwnerShell
      businessId={business.id}
      businessName={business.name}
      slug={business.slug}
      isAdmin={admin}
      user={{ email: user.email ?? "", name, avatarUrl }}
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
