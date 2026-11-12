import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** A pop-up panel. Drawn at the top level of the page so nothing (like the tab bar) covers it. */
export default function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-t-3xl bg-surface p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:rounded-3xl md:pb-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
