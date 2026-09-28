"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton({
  children = "Log out",
}: {
  children?: React.ReactNode;
}) {
  const router = useRouter();
  async function logOut() {
    await signOut({ redirect: false });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="secondary" type="button" onClick={logOut}>
      {children}
    </Button>
  );
}
