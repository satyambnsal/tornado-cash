interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

export function LoadingModal({ isOpen, message = "Connecting to wallet..." }: LoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="ui-fixed ui-inset-0 ui-z-50 ui-flex ui-items-center ui-justify-center ui-bg-black ui-bg-opacity-50">
      <div className="ui-bg-white dark:ui-bg-gray-800 ui-rounded-lg ui-p-8 ui-max-w-sm ui-w-full ui-mx-4 ui-shadow-xl">
        <div className="ui-flex ui-flex-col ui-items-center ui-space-y-4">
          {/* Spinner */}
          <div className="ui-relative">
            <div className="ui-h-12 ui-w-12 ui-rounded-full ui-border-4 ui-border-gray-200 dark:ui-border-gray-700"></div>
            <div className="ui-absolute ui-top-0 ui-left-0 ui-h-12 ui-w-12 ui-rounded-full ui-border-4 ui-border-blue-500 ui-border-t-transparent ui-animate-spin"></div>
          </div>

          {/* Message */}
          <p className="ui-text-gray-700 dark:ui-text-gray-300 ui-text-center ui-font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
