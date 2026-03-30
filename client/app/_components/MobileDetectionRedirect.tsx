"use client";

import { useEffect, useState } from "react";

const MOBILE_BANNER_DISMISS_KEY = "socio_mobile_recommendation_dismissed";

export default function MobileDetectionRedirect() {
  const [showBanner, setShowBanner] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile/i;
      const isMobileUA = mobileKeywords.test(userAgent);

      const isSmallScreen = window.innerWidth <= 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      return isMobileUA || (isSmallScreen && hasTouch);
    };

    const updateMobileStatus = () => {
      const dismissedInSession = sessionStorage.getItem(MOBILE_BANNER_DISMISS_KEY) === "1";
      setShowBanner(checkMobile() && !dismissedInSession);
      setIsReady(true);
    };

    updateMobileStatus();

    window.addEventListener('resize', updateMobileStatus);
    window.addEventListener('orientationchange', updateMobileStatus);

    return () => {
      window.removeEventListener('resize', updateMobileStatus);
      window.removeEventListener('orientationchange', updateMobileStatus);
    };
  }, []);

  const dismissBanner = () => {
    sessionStorage.setItem(MOBILE_BANNER_DISMISS_KEY, "1");
    setShowBanner(false);
  };

  const handleOpenApp = () => {
    const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL || "https://thesocio.vercel.app";
    window.location.assign(`${pwaBaseUrl}${window.location.pathname}${window.location.search}`);
  };

  if (!isReady || !showBanner) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-[#154CB3]/20 bg-white/95 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <div className="mt-0.5 rounded-xl bg-[#154CB3]/10 p-2 text-[#154CB3]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#063168]">
              Want a smoother mobile experience?
            </p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">
              SOCIO works better in the app. You can keep browsing on web if you prefer.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenApp}
                className="rounded-full bg-[#154CB3] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0f3d8a] sm:text-sm"
              >
                Open Mobile App
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                className="rounded-full border border-[#154CB3]/30 px-4 py-2 text-xs font-semibold text-[#154CB3] transition-colors hover:bg-[#154CB3]/5 sm:text-sm"
              >
                Continue to Web
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissBanner}
            className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Dismiss app recommendation"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
