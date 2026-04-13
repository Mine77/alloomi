import { auth } from "@/app/(auth)/auth";
import { AppError } from "@alloomi/shared/errors";
import { generateText } from "ai";
import { modelProvider } from "@/lib/ai";
import { setAIUserContextFromRequest } from "@/lib/ai/request-context";
import { z } from "zod";
import {
  getBotsByUserId,
  getUserRoles,
  getLatestSurveyByUserId,
  getUserInsightSettings,
  getStoredInsightsByBotIds,
} from "@/lib/db/queries";
import type { Insight } from "@/lib/db/schema";
import { insightIsUrgent } from "@/lib/insights/focus-classifier";

/**
 * Response structure for suggested conversations
 */
const SuggestedPromptSchema = z.object({
  id: z.string(),
  title: z.string(),
  emoji: z.string(),
  type: z.enum(["event_based", "pattern_based", "role_based"]),
  reasoning: z.string(),
  related_insight_ids: z.array(z.string()),
});

const SuggestionsResponseSchema = z.object({
  suggested_prompts: z.array(SuggestedPromptSchema).length(3),
});

/**
 * Extract categories from Insight
 * Prioritize the categories field, otherwise extract from the insights field
 */
function extractCategories(insight: Insight): string[] {
  // Prioritize the categories field in schema
  if (insight.categories && Array.isArray(insight.categories)) {
    return insight.categories.filter(
      (cat): cat is string => typeof cat === "string" && cat.length > 0,
    );
  }
  // If no categories field exists, extract from the insights field
  if (insight.insights && Array.isArray(insight.insights)) {
    return insight.insights
      .map((item) => item.category)
      .filter(
        (cat): cat is string => typeof cat === "string" && cat.length > 0,
      );
  }
  return [];
}

/**
 * Check if event is from today
 */
function isTodayEvent(time: Date | string, currentDate: string): boolean {
  const eventDate = typeof time === "string" ? new Date(time) : time;
  const eventDateStr = eventDate.toISOString().split("T")[0];
  return eventDateStr === currentDate;
}

/**
 * Check if event is high priority
 */
function isHighPriorityEvent(insight: Insight): boolean {
  const categories = extractCategories(insight);
  const hasImportantCategory = categories.some((cat) =>
    ["opportunity", "risk", "decision"].includes(cat),
  );
  return (
    insightIsUrgent(insight) ||
    insight.importance === "high" ||
    hasImportantCategory
  );
}

/**
 * Format Insight data for API requirements
 */
function formatInsightForAPI(insight: Insight): {
  id: string;
  title: string;
  description: string;
  taskLabel: string;
  importance: string;
  urgency: string;
  platform: string | null;
  account: string | null;
  people: string[];
  groups: string[];
  time: string;
  categories: string[];
  isUnreplied: boolean;
  actionRequired: boolean;
  sentiment: string | null;
  intent: string | null;
  trend: string | null;
} {
  return {
    id: insight.id,
    title: insight.title,
    description: insight.description,
    taskLabel: insight.taskLabel,
    importance: insight.importance,
    urgency: insight.urgency,
    platform: insight.platform ?? null,
    account: insight.account ?? null,
    people: Array.isArray(insight.people) ? insight.people : [],
    groups: Array.isArray(insight.groups) ? insight.groups : [],
    time:
      insight.time instanceof Date
        ? insight.time.toISOString()
        : typeof insight.time === "string"
          ? insight.time
          : new Date().toISOString(),
    categories: extractCategories(insight),
    isUnreplied: insight.isUnreplied ?? false,
    actionRequired: insight.actionRequired ?? false,
    sentiment: insight.sentiment ?? null,
    intent: insight.intent ?? null,
    trend: insight.trend ?? null,
  };
}

/**
 * Get user's insights from the past 24 hours
 */
async function getLast24HoursInsights(userId: string): Promise<Insight[]> {
  const bots = await getBotsByUserId({
    id: userId,
    limit: null,
    startingAfter: null,
    endingBefore: null,
    onlyEnable: false,
  });

  if (bots.bots.length === 0) {
    return [];
  }

  const botIds = bots.bots.map((bot) => bot.id);
  // Get insights from the past 1 day (24 hours)
  const { insights } = await getStoredInsightsByBotIds({
    ids: botIds,
    days: 1,
  });

  return insights;
}

/**
 * Build system prompt (based on Dialogue-Suggestion.md)
 */
function buildSystemPrompt(): string {
  return `# Alloomi 智能推荐对话生成系统提示词

> **版本**: 1.0  
> **目标**: 为 Alloomi 用户生成 3 条高度个性化、可立即使用的推荐对话，帮助用户从历史数据中获得洞察，而非执行具体操作。

---

## 系统角色定义

你是 Alloomi 的 **智能对话推荐引擎**，专门为用户生成个性化的探索性问题。你的职责是：

1. **基于用户上下文**（角色、行业、工作描述、关注主题、Insight 事件）生成 3 条推荐对话
2. **优先今日相关性**：如果今天有 Insight 事件，优先围绕今日事件生成问题
3. **重视用户偏好**：优先考虑用户手动选定的角色（\`source: "profile"\`）和关注主题（\`focusTopics\`）
4. **中度引导 + 开放启发**：问题应该帮助用户发现模式、趋势和关键信号，而非具体执行动作
5. **避免幻觉**：只基于提供的真实数据生成问题，不推测不存在的信息
6. **自然简洁**：每条推荐不超过 15 个字，符合对话式语气

---

## 生成规则

### 规则 1：优先级分配（基于数据可用性）

- **场景 A：今日有 Insight 事件**  
  - **2 条推荐** 围绕今日高优先级事件（\`urgency="urgent"\` 或 \`importance="high"\` 或 \`categories\` 包含"商机"/"风险"/"决策"）  
  - **1 条推荐** 基于用户其他事件洞察的问题（如果存在其他今日或历史事件，优先基于这些事件生成；否则基于角色/行业/关注主题）

- **场景 B：今日无 Insight，但有历史事件**  
  - **2 条推荐** 基于近期历史事件的模式分析（例如："本周哪些话题被反复提及？"）  
  - **1 条推荐** 基于用户其他事件洞察的问题（如果存在其他历史事件，优先基于这些事件生成；否则基于角色/行业/关注主题）

- **场景 C：无任何 Insight 事件（新用户）**  
  - **3 条推荐** 全部基于角色/行业/关注主题生成高价值探索问题

### 规则 2：问题类型分布

每条推荐必须属于以下三种类型之一：

1. **事件驱动型**（Event-Based）  
   - 基于具体 Insight 生成，帮助用户理解"发生了什么"  
   - 示例：\`"客户 A 的核心诉求是什么？"\`、\`"今日团队讨论的主要风险有哪些？"\`

2. **模式发现型**（Pattern-Based）  
   - 基于历史数据聚合，帮助用户发现趋势  
   - 示例：\`"本周哪些客户最活跃？"\`、\`"近期有哪些重复出现的问题？"\`

3. **角色定制型**（Role-Based）  
   - 基于用户角色/行业/工作描述/关注主题生成高频场景问题  
   - 优先考虑用户手动选定的角色（\`source: "profile"\`）和关注主题（\`focusTopics\`）  
   - 示例（销售角色 + 关注主题"客户关系"）：\`"我的潜在客户最近关注哪些话题？"\`  
   - 示例（产品经理角色 + 关注主题"用户反馈"）：\`"用户反馈中有哪些共性痛点？"\`

### 规则 3：禁止清单

❌ **不要生成执行型问题**：  
- 错误示例："帮我回复张三的消息"、"安排明天的会议"  
- 正确示例："张三最关心的问题是什么？"

❌ **不要推测不存在的信息**：  
- 如果 Insight 中没有"客户 B"，不要提到客户 B  
- 如果用户行业是"金融"，不要假设他们在做"支付产品"

❌ **不要过度具体**：  
- 错误示例："Slack 频道 #sales 中 14:32 的那条消息说了什么？"  
- 正确示例："销售频道今天讨论了哪些关键话题？"

---

## 输出格式

返回严格的 JSON 格式，不包含任何 Markdown 代码块标记：

\`\`\`json
{
  "suggested_prompts": [
    {
      "id": "string",             // Unique identifier, e.g., "suggest_001" or generated based on insight_id
      "title": "string",          // Recommended conversation text (≤15 chars), will be sent as user message after click
      "emoji": "string",          // Emoji icon, choose appropriate emoji based on type and content
      "type": "string",           // Type: "event_based" | "pattern_based" | "role_based" (metadata, for logging)
      "reasoning": "string",      // Generation reason (internal log use, not shown to user)
      "related_insight_ids": ["string"] // Related Insight IDs (if any, metadata)
    }
  ]
}
\`\`\`

### Emoji 选择指南

根据推荐类型和内容选择合适的 emoji：

- **事件驱动型（event_based）**：
  - 商机相关：💰、🎯、💼
  - 风险相关：⚠️、🚨、🔔
  - 决策相关：📋、💡、🎯
  - 客户询问：💬、📧、👥
  - 团队讨论：💭、🗣️、👥

- **模式发现型（pattern_based）**：
  - 趋势分析：📈、📊、🔍
  - 重复问题：🔄、⚠️、❓
  - 活跃度：🔥、⚡、📢

- **角色定制型（role_based）**：
  - 通用探索：🔍、💡、📬
  - 客户相关：👥、💼、🤝
  - 团队相关：👨‍👩‍👧‍👦、💬、📋
  - 产品相关：📱、🎨、✨

---

## 质量检查清单

生成结果后，请自我检查：

✅ 每条推荐的 \`title\` 是否 ≤15 字？  
✅ 是否为每条推荐选择了合适的 \`emoji\`？  
✅ 是否避免了执行型动词（"回复"、"安排"、"发送"）？  
✅ 是否所有提到的实体（人名、事件、平台）都在输入数据中存在？  
✅ 是否至少有 1 条推荐与用户角色/行业/关注主题相关？  
✅ 是否优先考虑了用户手动选定的角色和关注主题？  
✅ 每条推荐是否包含唯一的 \`id\`？  
✅ 输出是否为纯 JSON，不含 Markdown 标记？

---

你的目标是让用户打开 Alloomi 时，立即看到 3 个他们**真正需要了解的问题**，而不是通用模板。每条推荐都应该让用户感觉这正是他们需要探索的内容。

**语言风格要求**：
- 使用正式、专业的表达方式
- 避免口语化表达（如"啥"、"说什么"等）
- 使用规范的书面语
- 保持简洁明了，但不过于随意

---

## 语言要求

**重要**：输出语言必须严格遵循用户在助手档案中设置的"理解/回复语言"设置。

- 如果用户设置的是简体中文（zh-Hans/zh-CN），所有推荐对话的 \`title\` 字段必须使用简体中文
- 如果用户设置的是英文（en/en-US），所有推荐对话的 \`title\` 字段必须使用英文
- 系统提示词中会明确告知你用户的语言设置，请严格按照该语言生成推荐对话

现在，请基于输入数据生成推荐对话。`;
}

/**
 * GET /api/chat/suggestions
 * Generate personalized suggested conversations
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new AppError("unauthorized:insight").toResponse();
  }

  try {
    // Set AI user context for proper billing in proxy mode
    setAIUserContextFromRequest({
      userId: session.user.id,
      email: session.user.email || "",
      name: session.user.name || null,
      userType: session.user.type,
      request,
    });
    const userId = session.user.id;
    const currentDate = new Date().toISOString().split("T")[0];

    // 1. Get user role information
    const roles = await getUserRoles(userId);
    const userRoles = roles.map((role) => ({
      role: role.roleKey,
      source: role.source,
      confidence: role.confidence,
    }));

    // 2. Get user identity information (industry, work description)
    const latestSurvey = await getLatestSurveyByUserId(userId);
    const industries = latestSurvey?.industry
      ? latestSurvey.industry
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];
    const workDescription = latestSurvey?.workDescription ?? null;

    // 3. Get user focus topics and language settings
    const settings = await getUserInsightSettings(userId);
    const focusTopics = settings?.focusTopics ?? [];
    const userLanguage = settings?.language || "zh-Hans"; // Default to Simplified Chinese

    // 4. Get insights from the past 24 hours
    const insights = await getLast24HoursInsights(userId);

    // 5. Format data
    const formattedInsights = insights.map(formatInsightForAPI);

    // 6. Build input data
    const inputData = {
      user_profile: {
        roles: userRoles,
        industries,
        workDescription,
        focusTopics,
      },
      insights: formattedInsights,
      current_date: currentDate,
    };

    // 7. Build user prompt
    const hasTodayInsights = formattedInsights.some((insight) =>
      isTodayEvent(insight.time, currentDate),
    );
    const hasHistoryInsights = formattedInsights.length > 0;

    // Build prompt based on user language settings
    const isChinese =
      userLanguage.includes("zh") ||
      userLanguage === "zh-Hans" ||
      userLanguage === "zh-CN";
    const languageInstruction = isChinese
      ? "请使用简体中文生成推荐对话。"
      : "Please generate suggested prompts in English.";

    const userPrompt = isChinese
      ? `请基于以下用户数据生成 3 条推荐对话：

\`\`\`json
${JSON.stringify(inputData, null, 2)}
\`\`\`

**重要提示**：
- **输出语言**：${languageInstruction}所有推荐对话的 \`title\` 字段必须使用${isChinese ? "简体中文" : "English"}。
- **语言风格**：请使用正式、专业的表达方式，避免口语化表达（如"啥"、"说什么"等），使用规范的书面语。
- 当前日期：${currentDate}
- 如果 \`insights\` 数组中有事件，请根据事件的 \`time\` 字段判断是否为今日事件（日期部分等于当前日期）
- 场景判断：
  ${
    hasTodayInsights
      ? "- **场景 A**：今日有 Insight 事件（已检测到今日事件）"
      : hasHistoryInsights
        ? "- **场景 B**：今日无 Insight，但有历史事件（已传入历史事件，请基于这些事件生成模式分析问题）"
        : "- **场景 C**：无任何 Insight 事件（新用户，完全基于角色/行业/关注主题生成）"
  }

请严格按照输出格式返回 JSON，不要包含任何 Markdown 代码块标记。`
      : `Please generate 3 suggested prompts based on the following user data:

\`\`\`json
${JSON.stringify(inputData, null, 2)}
\`\`\`

**Important Notes**:
- **Output Language**: ${languageInstruction} All \`title\` fields in suggested prompts must be in ${isChinese ? "Simplified Chinese" : "English"}.
- Current Date: ${currentDate}
- If there are events in the \`insights\` array, determine if they are today's events by comparing the date part of the \`time\` field with the current date.
- Scenario:
  ${
    hasTodayInsights
      ? "- **Scenario A**: Today has Insight events (today's events detected)"
      : hasHistoryInsights
        ? "- **Scenario B**: No Insight today, but has historical events (historical events provided, please generate pattern analysis questions based on these events)"
        : "- **Scenario C**: No Insight events (new user, generate entirely based on role/industry/focus topics)"
  }

Please return JSON in strict format without any Markdown code block markers.`;

    // 8. Call LLM to generate suggestions
    const systemPrompt = buildSystemPrompt();
    const result = await generateText({
      model: modelProvider.languageModel("chat-model"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxRetries: 3,
    });

    // 9. Parse response
    let responseText = result.text.trim();
    // Remove possible Markdown code block markers
    responseText = responseText.replace(/^```json\s*/i, "");
    responseText = responseText.replace(/^```\s*/i, "");
    responseText = responseText.replace(/\s*```$/i, "");

    let parsedResponse: z.infer<typeof SuggestionsResponseSchema>;
    try {
      const jsonData = JSON.parse(responseText);
      parsedResponse = SuggestionsResponseSchema.parse(jsonData);
    } catch (error) {
      console.error(
        "[Chat Suggestions] Failed to parse LLM response:",
        error,
        "Response:",
        responseText,
      );
      // If parsing fails, return default suggestions
      return Response.json({
        suggested_prompts: [
          {
            id: "suggest_fallback_1",
            title: "今日有哪些重要消息？",
            emoji: "📬",
            type: "role_based" as const,
            reasoning: "默认推荐：通用探索问题",
            related_insight_ids: [],
          },
          {
            id: "suggest_fallback_2",
            title: "团队近期讨论的主要话题有哪些？",
            emoji: "💬",
            type: "role_based" as const,
            reasoning: "默认推荐：团队动态",
            related_insight_ids: [],
          },
          {
            id: "suggest_fallback_3",
            title: "有哪些潜在商机？",
            emoji: "💰",
            type: "role_based" as const,
            reasoning: "默认推荐：业务增长",
            related_insight_ids: [],
          },
        ],
      });
    }

    return Response.json(parsedResponse);
  } catch (error) {
    console.error("[Chat Suggestions] Failed to generate suggestions:", error);
    if (error instanceof AppError) {
      return error.toResponse();
    }
    return new AppError(
      "bad_request:insight",
      `Failed to generate suggestions: ${error instanceof Error ? error.message : String(error)}`,
    ).toResponse();
  }
}
