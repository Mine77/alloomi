import { auth } from "@/app/(auth)/auth";
import { Home } from "./home";
import { initializeSkillsBundler } from "@/lib/skills/init";

export default async function Page() {
  const session = await auth();

  // Init skills bundler and move project workspace skills to the user session workspace.
  await initializeSkillsBundler();

  return (
    <>
      <Home key="stable-chat-panel" />
    </>
  );
}
