"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/modal";

export function AccountDangerZone() {
  const [error, setError] = useState("");
  const router = useRouter();
  async function remove() {
    const response = await fetch("/api/v1/account", { method: "DELETE" });
    if (response.ok) {
      router.push("/");
      router.refresh();
    } else {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(
        body.error?.message ?? "Account deletion could not be requested.",
      );
    }
  }
  return (
    <div className="mt-5">
      <Button variant="secondary" type="button" disabled>
        Request data export (coming soon)
      </Button>
      <ConfirmationDialog
        trigger={
          <Button className="mt-3 block" variant="danger" type="button">
            Delete account
          </Button>
        }
        title="Delete your account?"
        description="Your account enters a 14-day pending deletion period. This action signs you out and restricts your profile."
        danger
        onConfirm={remove}
      />
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
