import type { DBUserCategory } from "@/lib/db/schema";

/**
 * User category data structure
 */
export type UserCategory = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Preset category template structure
 */
export type CategoryTemplate = {
  name: string;
  description: string;
};

/**
 * Request body for creating a category
 */
export type CategoryCreatePayload = {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  templateName?: string; // Template name if creating from a template
};

/**
 * Request body for updating a category
 */
export type CategoryUpdatePayload = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

/**
 * Request body for batch updating category sort order
 */
export type CategorySortOrderPayload = {
  categories: Array<{ id: string; sortOrder: number }>;
};

/**
 * Convert database model to API response format
 */
export function dbCategoryToApiCategory(
  dbCategory: DBUserCategory,
): UserCategory {
  return {
    id: dbCategory.id,
    userId: dbCategory.userId,
    name: dbCategory.name,
    description: dbCategory.description,
    isActive: dbCategory.isActive,
    sortOrder: dbCategory.sortOrder,
    createdAt: dbCategory.createdAt,
    updatedAt: dbCategory.updatedAt,
  };
}
