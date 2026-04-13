import { Home } from "../home";

/**
 * Inbox page: independent route, only renders insight flow EventsPanel.
 * Shares AgentPageClient with Focus page (/), distinguished by pathname for middle content.
 */
export default async function InboxPage() {
  return (
    <>
      <Home key="inbox" />
    </>
  );
}
