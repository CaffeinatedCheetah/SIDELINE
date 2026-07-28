"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton({
  children = "Log out",
}: {
  children?: React.ReactNode;
}) {
  async function logOut() {
    await signOut({ redirect: false });
    window.location.assign("/");
  }

  return (
    <Button
      variant="secondary"
      type="button"
      onClick={logOut}
    >
      {children}
    </Button>
  );
}
