import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Faqja nuk u gjet</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Ky link nuk ekziston ose biznesi e ka çaktivizuar faqen e rezervimeve.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/">Kthehu te faqja kryesore</Link>
      </Button>
    </div>
  );
}
