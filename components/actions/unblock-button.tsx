"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiAction } from "./api-action";
export function UnblockButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function unblock() {
    setLoading(true);
    setError("");
    try {
      await apiAction("blocks", { userId, block: false });
      router.refresh();
    } catch (value) {
      if (value instanceof Error && value.message !== "AUTH_REQUIRED")
        setError(value.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" loading={loading} onClick={unblock}>
        Unblock
      </Button>
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
