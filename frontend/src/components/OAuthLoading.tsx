/**
 * Loading spinner page shown during OAuth redirect
 */
export function OAuthLoading() {
  return (
    <div className="ui-fixed ui-inset-0 ui-z-[1000] ui-flex ui-items-center ui-justify-center ui-gap-6 ui-rounded-none sm:ui-rounded-[48px] ui-shadow-xl ui-p-10 ui-w-full sm:ui-max-w-lg md:ui-min-w-[560px] ui-bg-surface">
      <div className="ui-flex ui-flex-col ui-items-center ui-gap-6">
        {/* Spinner */}
        <div className="ui-relative ui-w-16 ui-h-16">
          <div className="ui-absolute ui-inset-0 ui-border-4 ui-border-gray-200 ui-rounded-full"></div>
          <div className="ui-absolute ui-inset-0 ui-border-4 ui-border-transparent ui-border-t-cta ui-rounded-full ui-animate-spin"></div>
        </div>

        {/* Loading text */}
        <div className="ui-flex ui-flex-col ui-items-center ui-gap-1.5">
          <p className="ui-text-text-primary ui-text-body-lg ui-font-medium">Loading...</p>
          <p className="ui-text-text-secondary ui-text-body">Please wait</p>
        </div>
      </div>
    </div>
  );
}
