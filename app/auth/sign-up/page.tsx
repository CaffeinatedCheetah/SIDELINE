import { redirect } from "next/navigation";
export default function SignUp() {
  redirect("/auth/sign-in?callbackUrl=/onboarding");
}
