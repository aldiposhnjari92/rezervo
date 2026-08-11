import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { ReadOnlyProvider } from "./read-only";
import { OwnerShell } from "./shell";
import { SuspendedBanner } from "./suspended-banner";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // Paralel: e dyta nuk pret të parën, dhe të dyja janë shkuardhje veç e veç.
  const [{ user, business }, admin] = await Promise.all([requireBusiness(), isPlatformAdmin()]);

  return (
    <OwnerShell
      businessId={business.id}
      businessName={business.name}
      slug={business.slug}
      isAdmin={admin}
      user={{
        email: user.email ?? "",
        // Google i jep këto; me email/fjalëkalim mungojnë dhe avatari bie te inicialet.
        name: user.name,
        avatarUrl: user.avatarUrl,
      }}
    >
      {business.suspended_at && (
        <SuspendedBanner
          suspendedAt={business.suspended_at}
          reason={business.suspended_reason}
        />
      )}
      <ReadOnlyProvider readOnly={Boolean(business.suspended_at)}>{children}</ReadOnlyProvider>
    </OwnerShell>
  );
}
