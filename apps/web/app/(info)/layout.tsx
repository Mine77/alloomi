/**
 * Info page routing group unified shell: min height, background, child pages responsible for top bar and content area.
 * Applies to static/info pages like terms, support, privacy, landing, etc.
 */
export default function InfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full bg-background">{children}</div>;
}
