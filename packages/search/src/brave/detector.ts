/**
 * Search Intent Detector
 *
 * Detects whether a user query requires real-time information from the web.
 */

const REALTIME_KEYWORDS = [
  // Time-related
  "今天",
  "昨天",
  "明天",
  "现在",
  "目前",
  "最新",
  "最近",
  "today",
  "yesterday",
  "tomorrow",
  "now",
  "latest",
  "recent",
  "current",
  "刚刚",
  "刚才",
  "刚才",
  "this week",
  "this month",
  "本周",
  "本月",

  // News/Events
  "新闻",
  "消息",
  "发布",
  "公布",
  " announcement",
  "news",
  "breaking",
  "事件",
  "发生了什么",
  "what happened",
  "what's happening",

  // Real-time data
  "价格",
  "股价",
  "天气",
  "股票",
  "汇率",
  "price",
  "stock",
  "weather",
  "currency",
  "rate",
  "行情",

  // Dynamic information
  "排名",
  "榜单",
  "排行榜",
  "ranking",
  "rank",
  "top",
  "best",

  // Live/Real-time
  "直播",
  "live",
  "实时",
  "real-time",
  "正在",
  "正在发生",

  // Updates/Version
  "更新",
  "新版本",
  "新功能",
  "update",
  "new version",
  "release",

  // Current status
  "状态",
  "情况",
  "如何",
  "怎么样",
  "how is",
  "how's",
];

/**
 * Check if the user query requires real-time information
 *
 * @param query - The user's message content
 * @returns true if the query likely needs real-time information
 */
export function needsRealTimeInfo(query: string): boolean {
  if (!query || typeof query !== "string") {
    return false;
  }

  const lowerQuery = query.toLowerCase();

  // Check for time-related keywords
  for (const keyword of REALTIME_KEYWORDS) {
    if (lowerQuery.includes(keyword.toLowerCase()) || query.includes(keyword)) {
      return true;
    }
  }

  // Check for question patterns that typically need real-time info
  const questionPatterns = [
    /现在\s*.*\s*(怎么样|如何|好吗)/,
    /今天\s*.*\s*(新闻|消息|天气)/,
    /(最新|最近)\s*.*\s*(消息|新闻|发布)/,
    /what'?s\s+(the\s+)?(latest|current|new)\s+/i,
    /how\s+((is|are)\s+)?(the\s+)?(stock|price|weather)/i,
    /any\s+(news|updates?|breaking)/i,
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(query)) {
      return true;
    }
  }

  return false;
}
