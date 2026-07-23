import { LegalPage } from "@/components/layout/legal-page";
export default function Guidelines() {
  return (
    <LegalPage
      title="Community guidelines"
      description="Debate the take. Respect the fan."
      sections={[
        {
          heading: "Bring sports substance",
          body: "Make clear claims, explain your reasoning, and challenge ideas rather than identities. Predictions are entertainment and never wagering.",
        },
        {
          heading: "No abuse",
          body: "Threats, hateful conduct, targeted harassment, doxxing, spam, impersonation, and manipulated engagement are prohibited.",
        },
        {
          heading: "Moderation",
          body: "Moderators may remove content, warn or mute users, and preserve audit records. Reports are reviewed in context and abusive reporting may itself be restricted.",
        },
      ]}
    />
  );
}
