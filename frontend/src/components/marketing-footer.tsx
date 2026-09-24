export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          CampaignHub AI is built by{' '}
          <a
            href="https://sreematechhub.com/"
            target="_blank"
            rel="noopener"
            className="text-neutral-300 hover:text-neutral-50 hover:underline"
          >
            SreeMa Tech Hub
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/blog" className="text-neutral-300 hover:text-neutral-50 hover:underline">
            Blog
          </a>
          <a href="/roadmap" className="text-neutral-300 hover:text-neutral-50 hover:underline">
            Roadmap
          </a>
          <a href="/terms" className="text-neutral-300 hover:text-neutral-50 hover:underline">
            Terms of Service
          </a>
          <a href="/privacy" className="text-neutral-300 hover:text-neutral-50 hover:underline">
            Privacy Policy
          </a>
          <p>&copy; {new Date().getFullYear()} SreeMa Tech Hub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
