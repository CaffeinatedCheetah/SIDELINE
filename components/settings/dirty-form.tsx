"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function DirtyForm({
  action,
  children,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    // Covers tab close/reload/typed-URL navigation. In-app <Link> clicks
    // (client-side route transitions) aren't intercepted by this -- the App
    // Router has no built-in navigation-guard hook, and adding one would
    // mean a router-patching library beyond this page's scope.
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form
      ref={formRef}
      action={action}
      onChange={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
    >
      {children}
      {dirty && (
        <div className="bg-surface-2 border-border-strong sticky bottom-0 mt-5 flex items-center gap-3 rounded-md border p-4 shadow-2xl">
          <Button type="submit">Save changes</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              formRef.current?.reset();
              setDirty(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}
