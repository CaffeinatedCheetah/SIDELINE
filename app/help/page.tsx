import { LegalPage } from "@/components/layout/legal-page";
export default function Help() {
  return (
    <LegalPage
      title="Help center"
      description="Get back to the game and the conversation."
      sections={[
        {
          heading: "Using FanTakes",
          body: "Browse games and public conversation without an account. Sign in to post, vote, predict, join communities, save content, and follow fans.",
        },
        {
          heading: "Account help",
          body: "Magic links expire for safety. Request a new link from the sign-in page. Contact support before creating a replacement account if access is lost.",
        },
        {
          heading: "Safety",
          body: "Use Report on content that violates the guidelines. Immediate threats should be reported to local emergency services; FanTakes is not an emergency service.",
        },
      ]}
    />
  );
}
