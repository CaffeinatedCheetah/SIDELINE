import { signIn } from "next-auth/react";
export async function apiAction<T>(
  resource: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1/${resource}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { code: string; message: string };
  };
  if (response.status === 401) {
    await signIn(undefined, { callbackUrl: window.location.pathname });
    throw new Error("AUTH_REQUIRED");
  }
  if (!response.ok || !body.data)
    throw new Error(
      body.error?.message ?? "The action could not be completed.",
    );
  return body.data;
}
