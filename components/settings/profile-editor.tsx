"use client";

import { useState } from "react";

import { DirtyForm } from "@/components/settings/dirty-form";
import { Avatar, Card } from "@/components/ui/foundations";
import { Field, Input, Textarea } from "@/components/ui/form-controls";

export function ProfileEditor({
  action,
  initial,
}: {
  action: (formData: FormData) => void;
  initial: {
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string;
  };
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);

  return (
    <DirtyForm action={action}>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="grid gap-4">
          <Field label="Display name" htmlFor="displayName">
            <Input
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={50}
              required
            />
          </Field>
          <Field
            label="Username"
            htmlFor="handle"
            help="3–30 lowercase letters, numbers, or hyphens."
          >
            <Input
              id="handle"
              name="handle"
              value={handle}
              onChange={(event) =>
                setHandle(event.target.value.toLowerCase().replace(/\s/g, "-"))
              }
              pattern="[a-z0-9-]{3,30}"
              required
            />
          </Field>
          <Field label="Bio" htmlFor="bio">
            <Textarea
              id="bio"
              name="bio"
              maxLength={300}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </Field>
          <Field
            label="Avatar URL"
            htmlFor="avatarUrl"
            help="A direct HTTPS image link."
          >
            <Input
              id="avatarUrl"
              name="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </Field>
        </div>
        <Card className="bg-brand-surface/20 h-fit">
          <p className="text-text-muted text-xs font-bold tracking-wider uppercase">
            Live preview
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar
              name={displayName || "Fan"}
              src={avatarUrl || undefined}
              size="lg"
            />
            <div className="min-w-0">
              <strong className="block truncate">{displayName || "Fan"}</strong>
              <span className="text-text-muted block truncate text-sm">
                @{handle || "username"}
              </span>
            </div>
          </div>
          <p className="text-text-secondary mt-3 text-sm">
            {bio || "Your bio will appear here."}
          </p>
        </Card>
      </div>
    </DirtyForm>
  );
}
