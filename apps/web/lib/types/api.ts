import type { Chat } from "@/lib/db/schema";

// Extended chat type with additional statistics
export type ChatWithExtendedInfo = Chat & {
  latestMessageTime: Date | null;
  latestMessageContent: string | null;
  messageCount: number;
};

// Chat History API response type
export type ChatHistoryResponse = {
  chats: ChatWithExtendedInfo[];
  hasMore: boolean;
};

// Other API response types can be added here
export type ApiResponse<T = any> = {
  data?: T;
  error?: string;
  message?: string;
};
