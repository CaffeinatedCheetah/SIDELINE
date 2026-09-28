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
    // Discard authenticated router caches and cancel in-flight page requests.
    window.location.assign(window.location.origin);
  }

  return (
    <Button variant="secondary" type="button" onClick={logOut}>
      {children}
    </Button>
  );
}
