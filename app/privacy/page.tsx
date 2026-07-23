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
          body: "Profile and notification choices are available in Settings. Account deletion enters a review period before personal fields are removed under the published retention policy.",
        },
        {
          heading: "Data protection",
          body: "Private fields are excluded from public APIs. OAuth credentials, session data, and moderation records receive restricted server-side access.",
        },
      ]}
    />
  );
}
