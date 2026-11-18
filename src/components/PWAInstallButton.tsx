import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-md transition-opacity hover:opacity-90 cursor-pointer"
        style={{
          backgroundColor: 'var(--m3-primary)',
          color: 'var(--m3-on-primary)',
        }}
      >
        <Download size={15} />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold shadow-sm cursor-pointer"
          style={{
            backgroundColor: 'var(--m3-secondary-container)',
            color: 'var(--m3-on-secondary-container)',
          }}
        >
          <Download size={15} />
          Install App
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-[28px] p-6 shadow-2xl space-y-3"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                color: 'var(--m3-on-surface)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold">Install Tomato</h3>
              <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-full text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
