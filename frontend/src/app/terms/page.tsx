export const metadata = {
  title: 'Terms of Service — CampaignHub AI',
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-neutral-200">
      <h1 className="text-2xl font-semibold text-neutral-50">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: September 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          These terms govern your use of CampaignHub AI (&quot;the platform&quot;, &quot;we&quot;,
          &quot;our&quot;), a social media management tool built and operated by SreeMa Tech Hub.
          By creating an account or using the platform, you agree to these terms.
        </p>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">The service</h2>
          <p className="mt-2">
            CampaignHub AI lets marketing agencies and their clients plan, approve, schedule, and
            publish social media content, connect their own social media accounts, and use AI
            tools to help create that content. Publishing support varies by platform — some
            platforms publish directly through the platform&apos;s own API, and others are
            currently simulated (recorded inside CampaignHub AI but not sent to the real
            platform) while we complete each platform&apos;s developer approval process. The
            platform will always show you clearly which is which.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Accounts and responsibility</h2>
          <p className="mt-2">
            You&apos;re responsible for the accuracy of the information you provide, for keeping
            your login credentials secure, and for everything that happens under your account —
            including content your team members or connected clients create or publish through
            it. You must be legally able to enter into these terms, and to hold the social media
            accounts you connect.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Subscriptions, billing, and cancellation</h2>
          <p className="mt-2">
            Paid plans are billed monthly or yearly through Razorpay, in Indian Rupees, with GST
            invoiced as applicable under Indian law. You can cancel your subscription at any time
            from the Billing page — cancellation stops future billing but does not automatically
            refund the current billing period. Refunds are handled case-by-case; contact us if you
            believe you&apos;re owed one, and we&apos;ll review it in good faith. Cancelling does
            not delete your data — see our{' '}
            <a href="/privacy" className="text-accent-300 hover:underline">
              Privacy Policy
            </a>{' '}
            for how long we keep it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Acceptable use</h2>
          <p className="mt-2">
            Don&apos;t use CampaignHub AI to publish content that&apos;s illegal, infringes
            someone else&apos;s rights, or violates the terms of service of the social media
            platform you&apos;re publishing to. You&apos;re responsible for what you publish
            through the platform, including anything generated with its AI tools — review AI-
            generated content before it goes out under your name or your clients&apos;.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Availability and changes</h2>
          <p className="mt-2">
            We aim to keep CampaignHub AI available and reliable, but we don&apos;t guarantee
            uninterrupted access — maintenance, third-party platform outages (social networks,
            payment processors, AI providers), or unforeseen issues can affect availability. We
            may update these terms or the platform&apos;s features over time; material changes to
            these terms will be reflected here with an updated date.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Liability</h2>
          <p className="mt-2">
            CampaignHub AI is provided on an &quot;as is&quot; basis. To the extent permitted by
            law, SreeMa Tech Hub isn&apos;t liable for indirect, incidental, or consequential
            damages arising from your use of the platform, including content published through it
            or actions taken by connected social media platforms. Nothing here limits liability
            that can&apos;t be limited under applicable Indian law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-50">Contact</h2>
          <p className="mt-2">
            Questions about these terms can be sent to the account owner listed on this
            platform&apos;s business registration.
          </p>
        </section>
      </div>
    </div>
  );
}
