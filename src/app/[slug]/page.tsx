import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createPublicClient } from "@/lib/supabase/public";
import type { PublicBusiness } from "@/lib/types";
import { BookingFlow } from "./booking-flow";

/** Të dhënat e biznesit ndryshojnë rrallë; slot-et merren veçmas nga klienti. */
export const revalidate = 60;

async function getBusiness(slug: string): Promise<PublicBusiness | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_business", { p_slug: slug });

  if (error) {
    console.error("[getBusiness]", error.message);
    return null;
  }
  return (data as PublicBusiness | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const business = await getBusiness(params.slug);
  if (!business) return { title: "Faqja nuk u gjet" };

  return {
    title: `${business.name} — Rezervo online`,
    description: `Rezervo online te ${business.name}. Zgjidh shërbimin dhe orën që të përshtatet, pa telefonata.`,
    openGraph: {
      title: `${business.name} — Rezervo online`,
      description: "Zgjidh shërbimin dhe orën. Pa telefonata.",
    },
  };
}

export default async function PublicBookingPage({ params }: { params: { slug: string } }) {
  const business = await getBusiness(params.slug);
  if (!business) notFound();

  return <BookingFlow business={business} />;
}
