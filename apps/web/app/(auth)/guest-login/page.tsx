"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Guest login page - automatically creates a guest account and redirects to home.
 * This page is used when users access the app without logging in.
 */
export default function GuestLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Create guest account and sign in
    const createGuestAndLogin = async () => {
      try {
        const response = await fetch("/api/auth/guest", {
          method: "POST",
        });

        if (response.ok) {
          // Successful login, reload the page to get the new session
          router.push("/");
          router.refresh();
        } else {
          console.error("[GuestLogin] Failed to create guest account");
          // Fallback: try normal login page
          router.push("/");
        }
      } catch (error) {
        console.error("[GuestLogin] Error:", error);
        router.push("/");
      }
    };

    createGuestAndLogin();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Creating guest account...</p>
      </div>
    </div>
  );
}
