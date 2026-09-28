import { LegalPage } from "@/components/layout/legal-page";
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      description="What FanTakes stores and why."
      sections={[
        {
          heading: "Data collected",
          body: "FanTakes stores account identity, profile choices, authored activity, votes, predictions, safety reports, and limited operational analytics required to run the service.",
        },
        {
          heading: "Controls",
          body: "Profile and notification choices are available in Settings. Account deletion restricts access immediately. After 14 days, a daily job removes login credentials, profile fields and authored text. An anonymized account record, votes and safety/audit records may remain to preserve conversation integrity and investigate abuse.",
        },
        {
          heading: "Data protection",
          body: "Private fields are excluded from public APIs. OAuth credentials, session data, and moderation records receive restricted server-side access.",
        },
      ]}
    />
  );
}
