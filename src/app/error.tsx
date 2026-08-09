"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Diçka shkoi keq</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Na ndodhi një gabim i papritur. Provo sërish — nëse vazhdon, rifresko faqen.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Provo sërish
      </Button>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Kodi: {error.digest}</p>
      )}
    </div>
  );
}
