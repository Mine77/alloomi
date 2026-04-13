"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(() => import("sonner").then((c) => c.Toaster), {
  ssr: false,
});

export function SonnerToaster() {
  return <Toaster position="top-center" />;
}
