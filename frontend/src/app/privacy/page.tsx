export const metadata = {
  title: 'Privacy Policy — CampaignHub AI',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-neutral-200">
      <h1 className="text-2xl font-semibold text-neutral-50">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: September 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          CampaignHub AI (&quot;we&quot;, &quot;our&quot;, &quot;the platform&quot;) is a social media
          management tool that lets marketing agencies and their clients connect their own social
          media accounts (Facebook, Instagram, WhatsApp, LinkedIn, X, YouTube, Pinterest, and
          others) to schedule, publish, and analyze content.
        </p>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">What we access</h2>
          <p className="mt-2">
            When you connect a social media account, we request only the permissions needed to
            read your basic profile information and, where you enable it, to publish content on
            your behalf. We never post, message, or make changes to a connected account without
            an explicit action you take inside CampaignHub AI.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">How we store data</h2>
          <p className="mt-2">
            Access tokens for connected accounts are encrypted at rest and are never exposed to
            the browser or to any party other than the account owner&apos;s own agency workspace.
            We do not sell or share your data with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Removing access</h2>
          <p className="mt-2">
            You can disconnect any connected social media account at any time from the Social
            Accounts page inside CampaignHub AI, which immediately removes our stored access to
            that account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Contact</h2>
          <p className="mt-2">
            Questions about this policy can be sent to the account owner listed on this
            platform&apos;s business registration.
          </p>
        </section>
      </div>
    </div>
  );
}
