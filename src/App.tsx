import Clarity from "@microsoft/clarity";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useWhoamiQuery } from "@/api/authApi";
import { useAuth } from "@/features/auth/useAuth";
import { UploadStatusWidget } from "@/features/uploads/UploadStatusWidget";
import { LoadingState } from "@/components/ui/StateViews";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { AppRoutes } from "@/routes/AppRoutes";

export default function App() {
  // Runs once on mount and restores "who's logged in" from the session
  // cookie. Nothing else renders its real content until this resolves —
  // otherwise a valid-session refresh would flash the login page first.
  const { isLoading } = useWhoamiQuery();
  const { user, isAuthenticated } = useAuth();
  const { key: pageKey } = useLocation();
  const email = user?.email;

  useEffect(() => {
    if (!isAuthenticated || !email) return;

    // Keep the Custom user ID attached after login, session restore, and navigation.
    Clarity.identify(email);
  }, [email, isAuthenticated, pageKey]);

  return (
    <>
      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-surface-muted">
          <LoadingState label="Loading HPH Inhouse…" />
        </div>
      ) : (
        <AppRoutes />
      )}
      <ToastContainer />
      {user && <UploadStatusWidget />}
    </>
  );
}
