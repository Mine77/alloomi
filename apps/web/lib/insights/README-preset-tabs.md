# Preset Tabs 配置管理

## 概述

`preset-tabs-config.ts` 文件集中管理所有预设的 Insight Tab 分组配置，便于维护和扩展。

## 文件结构

```
lib/insights/
├── preset-tabs-config.ts    # 预设分组配置
└── README-preset-tabs.md     # 配置说明文档
```

## 使用方式

### 获取预设分组配置

```typescript
import { getPresetTabsConfig } from "@/lib/insights/preset-tabs-config";
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
const presetTabs = getPresetTabsConfig(t);
```

### 判断是否为预设分组

```typescript
import { isPresetTabId } from "@/lib/insights/preset-tabs-config";

if (isPresetTabId(tabId)) {
  console.log("这是一个预设分组");
}
```

### 获取所有预设分组 ID

```typescript
import { PRESET_TAB_IDS } from "@/lib/insights/preset-tabs-config";

console.log(PRESET_TAB_IDS);
// ['preset:important-people', 'preset:mentions-me', ...]
```

## 当前预设分组列表

### 1. 重要人物 (VIP)

- **ID**: `preset:important-people`
- **默认显示**: 是
- **可修改**: 是（可修改人员列表）
- **用途**: 筛选来自重要人物的信息

### 2. 联系我的 (@Me)

- **ID**: `preset:mentions-me`
- **默认显示**: 是
- **可修改**: 否
- **用途**: 自动匹配@你或直接私聊的信息

### 3. 重要的 (Important)

- **ID**: `preset:important`
- **默认显示**: 是
- **可修改**: 否
- **用途**: 筛选标记为重要的信息

### 4. 会议 (Meetings)

- **ID**: `preset:meetings`
- **默认显示**: 否
- **可修改**: 否
- **用途**: 筛选所有会议相关的信息

### 5. 资讯 (News)

- **ID**: `preset:news`
- **默认显示**: 否
- **可修改**: 否
- **用途**: 筛选新闻和资讯类信息

## 添加新的预设分组

在 `preset-tabs-config.ts` 的 `getPresetTabsConfig` 函数中添加新的配置对象：

```typescript
{
  id: "preset:your-new-preset",
  name: t("insight.tabs.preset.yourNewPreset", "你的预设名称"),
  title: t("insight.tabs.preset.yourNewPreset", "你的预设名称"),
  description: t(
    "insight.tabs.preset.yourNewPresetDesc",
    "你的预设描述",
  ),
  filter: {
    match: "all",
    conditions: [
      // 你的过滤条件
    ],
  },
  type: "preset",
  enabled: false,
  createdAt: 0,
  updatedAt: 0,
  tag: "",
  isDefault: false,  // 是否默认显示
  modifiable: false, // 是否允许修改
  rules: {
    canModifyKind: false,   // 是否可修改条件类型
    canModifyValues: false, // 是否可修改条件值
  },
}
```

## 配置字段说明

### 基础字段

- `id`: 预设分组的唯一标识，格式为 `preset:xxx`
- `name`: 显示名称（支持国际化）
- `title`: 标题（通常与 name 相同）
- `description`: 描述信息（支持国际化）

### 过滤器字段

- `filter`: 过滤规则配置
  - `match`: 匹配模式（`all` 或 `any`）
  - `conditions`: 过滤条件数组

### 元数据字段

- `type`: 固定为 `"preset"`
- `enabled`: 是否启用（默认为 `false`）
- `createdAt`: 创建时间（预设分组为 `0`）
- `updatedAt`: 更新时间（预设分组为 `0`）
- `tag`: 分类标签（用于模板库，目前为空字符串）
- `isDefault`: 是否默认显示在分组页
- `modifiable`: 是否允许用户修改

### 规则配置字段

- `rules`: 编辑权限配置
  - `canModifyKind`: 是否可以修改条件类型
  - `canModifyValues`: 是否可以修改条件值

## 国际化支持

所有预设分组的名称和描述都支持国际化，需在以下文件中添加对应的翻译：

- `i18n/locales/zh-Hans.ts`
- `i18n/locales/en-US.ts`

示例：

```typescript
insight: {
  tabs: {
    preset: {
      yourNewPreset: "你的预设名称",
      yourNewPresetDesc: "你的预设描述",
    },
  },
},
```

## 最佳实践

1. **保持配置集中**: 所有预设分组配置都应在此文件中定义
2. **使用国际化**: 所有文本内容都应使用 `t()` 函数包裹
3. **清晰的命名**: 使用语义化的 ID 和名称
4. **合理的默认值**: 根据用户需求设置 `isDefault` 和 `modifiable`
5. **完整的描述**: 为每个预设分组提供清晰的描述信息

## 相关文件

- `/hooks/use-insight-tabs.ts` - 使用预设分组配置的 Hook
- `/components/agent/insight-tabs-dialog.tsx` - 分组管理对话框
- `/components/agent/insight-tab-edit-dialog.tsx` - 分组编辑对话框
