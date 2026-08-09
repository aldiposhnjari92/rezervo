"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={loading}
      title={collapsed ? "Dil" : undefined}
      className={
        collapsed
          ? "h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
          : "w-full justify-start text-muted-foreground hover:text-foreground"
      }
    >
      <LogOut className="h-4 w-4" />
      {!collapsed && <span>Dil</span>}
    </Button>
  );
}
