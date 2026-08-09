"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme";

export function AccountSection({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pamja</CardTitle>
          <CardDescription>
            &quot;Sistemi&quot; ndjek rregullimin e telefonit ose kompjuterit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle className="max-w-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Llogaria ime</CardTitle>
          <CardDescription>
            Email, fjalëkalim dhe fshirje e llogarisë.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/account">
              Hap llogarinë
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Paneli i platformës
            </CardTitle>
            <CardDescription>
              Kjo llogari ka të drejta admini mbi të gjitha bizneset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin">
                Hap panelin
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
