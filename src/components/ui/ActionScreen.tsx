import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ScreenEntry = { id: string; close: () => void };
let screens: ScreenEntry[] = [];
let screenIds: string[] = [];
const subscribers = new Set<() => void>();
const retiredHistoryIds = new Set<string>();
let internalBackPending = false;
let listeningForHistory = false;
let workspaceState: {
  main: HTMLElement;
  root: HTMLElement;
  display: string;
  inert: boolean;
  rootDisplay: string;
  scrollTop: number;
  skipLink: HTMLAnchorElement | null;
} | null = null;

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}

function publishScreens() {
  screenIds = screens.map((screen) => screen.id);
  subscribers.forEach((callback) => callback());
}

function goBackInternally() {
  if (internalBackPending) return;
  internalBackPending = true;
  window.history.back();
}

function handleHistoryBack() {
  if (internalBackPending) {
    internalBackPending = false;
    // When a parent and its confirmation close together, remove both
    // temporary entries before returning to the original list.
    if (retiredHistoryIds.has(window.history.state?.hphActionScreen)) goBackInternally();
    return;
  }
  screens.at(-1)?.close();
}

/** A focused workspace screen. The originating view stays mounted for its return state. */
export function ActionScreen({
  open,
  onClose,
  title,
  description,
  children,
  widthClass = "max-w-6xl",
  fitContent = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClass?: string;
  fitContent?: boolean;
}) {
  const titleId = useId();
  const historyId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const stack = useSyncExternalStore(subscribe, () => screenIds);
  const isTopScreen = stack.at(-1) === historyId;

  useLayoutEffect(() => {
    if (!open) return;
    const root = document.getElementById("action-screen-root");
    const workspace = document.getElementById("workspace-main");
    if (!root || !workspace) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const parentScrollTop = root.scrollTop;
    const originalUrl = window.location.href;
    let ownsHistory = false;
    if (!workspaceState) {
      const skipLink = document.querySelector<HTMLAnchorElement>('a[href="#workspace-main"]');
      workspaceState = { main: workspace, root, display: workspace.style.display, inert: workspace.inert,
        rootDisplay: root.style.display, scrollTop: workspace.scrollTop, skipLink };
      workspace.style.display = "none";
      workspace.inert = true;
      root.style.display = "block";
      if (skipLink) skipLink.href = "#workspace-action-main";
    }
    retiredHistoryIds.delete(historyId);
    screens = [...screens, { id: historyId, close: () => closeRef.current() }];
    publishScreens();
    root.scrollTop = 0;
    setHost(root);

    if (!listeningForHistory) {
      window.addEventListener("popstate", handleHistoryBack);
      listeningForHistory = true;
    }
    const focusFrame = window.requestAnimationFrame(() => {
      // Defer until the screen is committed so StrictMode's setup/cleanup
      // rehearsal cannot add an extra history entry.
      // Keep the originating URL valid when directly opened or reloaded.
      if (window.location.href === originalUrl) {
        window.history.pushState({ ...window.history.state, hphActionScreen: historyId }, "", originalUrl);
        ownsHistory = true;
      }
      headingRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      const wasTop = screens.at(-1)?.id === historyId;
      screens = screens.filter((screen) => screen.id !== historyId);
      publishScreens();
      if (ownsHistory) retiredHistoryIds.add(historyId);
      if (screens.length === 0 && workspaceState) {
        const saved = workspaceState;
        saved.main.style.display = saved.display;
        saved.main.inert = saved.inert;
        saved.main.scrollTop = saved.scrollTop;
        saved.root.style.display = saved.rootDisplay;
        if (saved.skipLink) saved.skipLink.href = "#workspace-main";
        workspaceState = null;
      } else if (wasTop) {
        root.scrollTop = parentScrollTop;
      }
      // Saving or cancelling may close the component directly. Remove only
      // the temporary entry owned by this screen, never another route's entry.
      if (ownsHistory && window.location.href === originalUrl && window.history.state?.hphActionScreen === historyId) {
        goBackInternally();
      }
      if (wasTop) window.requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, [historyId, open]);

  if (!open || !host) return null;

  return createPortal(
    <main id={isTopScreen ? "workspace-action-main" : undefined} tabIndex={-1}
      className={`mx-auto flex w-full max-w-screen-2xl flex-col gap-6 outline-none ${fitContent ? "action-screen-fit" : ""}`}
      style={{ display: isTopScreen ? undefined : "none" }} aria-labelledby={titleId}>
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-fit items-center gap-2 rounded-md px-1 py-2 text-sm font-medium text-brand-700 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m8 4-6 6 6 6M2 10h16" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to results
        </button>
        <div>
          <h1 id={titleId} ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-content-primary outline-none">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm text-content-muted">{description}</p>}
        </div>
      </header>
      <div className={`w-full ${widthClass}`}>{children}</div>
    </main>,
    host,
  );
}
