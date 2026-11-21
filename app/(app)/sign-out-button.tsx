"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Encerra a sessão (navegador → /api/auth/sign-out) e volta para o login. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="h-10 px-2.5 text-muted-foreground hover:text-foreground sm:px-3"
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {pending ? "Saindo…" : "Sair"}
    </Button>
  );
}
