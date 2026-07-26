"use client";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form-controls";

export function SectionSelect({
  sections,
  active,
}: {
  sections: readonly { key: string; label: string }[];
  active: string;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label="Settings section"
      className="mb-4 lg:hidden"
      value={active}
      onChange={(event) => router.push(`/settings?section=${event.target.value}`)}
    >
      {sections.map(({ key, label }) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </Select>
  );
}
