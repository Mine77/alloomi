/**
 * Unified shell for auth route group: minimal height, background, sub-pages are responsible for centering and form layout.
 * New auth pages can reuse the AuthCard container from components/auth/auth-layout.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full bg-background">{children}</div>;
}
