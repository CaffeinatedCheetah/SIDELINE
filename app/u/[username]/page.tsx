import type { Metadata } from "next";

import ProfilePage, {
  generateMetadata as generateProfileMetadata,
} from "@/app/users/[handle]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return generateProfileMetadata({
    params: Promise.resolve({ handle: username }),
  });
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const { username } = await params;
  return ProfilePage({
    params: Promise.resolve({ handle: username }),
    searchParams,
  });
}
