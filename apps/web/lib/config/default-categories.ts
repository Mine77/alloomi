import type { CategoryTemplate } from "@/lib/types/categories";

/**
 * Preset category template configuration
 * Users can select from these templates to add categories to their list
 */
export const DEFAULT_CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    name: "News",
    description:
      "Industry news, political news, company updates. Stay on top of what matters.",
  },
  {
    name: "Meetings",
    description:
      "Formal meetings, workshops, internal and online meetings. Never miss an important meeting.",
  },
  {
    name: "Funding",
    description:
      "Funding rounds, investments, fundraising updates. Track key progress on financing.",
  },
  {
    name: "R&D",
    description:
      "R&D milestones, technical breakthroughs, product updates, prototype testing. Track R&D and product progress.",
  },
  {
    name: "Partnerships",
    description:
      "Strategic partnerships, joint ventures, agreements, alliances. Key updates on external collaboration.",
  },
  {
    name: "User Growth",
    description:
      "User acquisition, engagement, retention, market penetration. Capture important changes in user growth.",
  },
  {
    name: "Branding",
    description:
      "Brand engagement, campaigns, PR. Important feedback and interaction around brand.",
  },
  {
    name: "Marketing",
    description:
      "Campaigns, promotion, channels, acquisition, content marketing. Stay on top of market and growth.",
  },
  {
    name: "HR",
    description:
      "Staff changes, team expansion, talent acquisition. Keep an eye on team and talent.",
  },
  {
    name: "Recruiting",
    description:
      "Hiring, talent acquisition, team expansion. Keep an eye on recruiting activity.",
  },
];

/**
 * Get all preset category templates
 */
export function getDefaultCategoryTemplates(): CategoryTemplate[] {
  return DEFAULT_CATEGORY_TEMPLATES;
}

/**
 * Get preset category template by name
 */
export function getDefaultCategoryTemplateByName(
  name: string,
): CategoryTemplate | undefined {
  return DEFAULT_CATEGORY_TEMPLATES.find(
    (template) => template.name.toLowerCase() === name.toLowerCase(),
  );
}
