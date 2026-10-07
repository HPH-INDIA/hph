import { useEffect, useState } from "react";

import { useMyActiveSessionsQuery } from "@/api/sessionsApi";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// Ticks once a second purely for display — the source of truth for "when did
// this session start" is the backend's own session row (createdAt), not any
// client-side login timestamp, so the duration survives page reloads.
export function SessionFooter() {
  const { data: sessions } = useMyActiveSessionsQuery();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentSession = sessions?.find((session) => session.isCurrent);
  const sessionDuration = currentSession
    ? formatDuration(now.getTime() - new Date(currentSession.createdAt).getTime())
    : null;

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-white/80 px-6 py-2 text-xs text-content-muted backdrop-blur">
      <span>{now.toLocaleString()}</span>
      {sessionDuration && <span>Session duration: {sessionDuration}</span>}
    </footer>
  );
}
