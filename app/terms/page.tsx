import { LegalPage } from "@/components/layout/legal-page";
export default function Terms() {
  return (
    <LegalPage
      title="Terms of service"
      description="The Version 1 service terms summary."
      sections={[
        {
          heading: "Your account",
          body: "You are responsible for accurate account information, account security, and activity performed through your session.",
        },
        {
          heading: "Your content",
          body: "You retain ownership of authored content and grant FanTakes the rights needed to display, moderate, and operate it. Do not post content you lack permission to share.",
        },
        {
          heading: "Service limits",
          body: "FanTakes provides sports conversation and predictions without wagering or prizes. Features may change, and abusive or unlawful activity may be restricted.",
        },
      ]}
    />
  );
}
