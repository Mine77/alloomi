"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import useSWR, { mutate as globalMutate } from "swr";
import { RemixIcon } from "@/components/remix-icon";
import { Badge, Button, Input, Label, Switch, Textarea } from "@alloomi/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@alloomi/ui";
import { TwoPaneSidebarLayout } from "@/components/layout/two-pane-sidebar-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@alloomi/ui";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/utils";
import { toast } from "@/components/toast";
import type {
  UserCategory,
  CategoryTemplate,
  CategoryCreatePayload,
  CategoryUpdatePayload,
} from "@/lib/types/categories";

/**
 * Categories list response
 */
type CategoriesResponse = {
  categories: UserCategory[];
};

/**
 * Templates list response
 */
type TemplatesResponse = {
  templates: CategoryTemplate[];
};

/**
 * Hook to get user categories
 */
function useUserCategories() {
  const { data, isLoading, mutate, error } = useSWR<CategoriesResponse>(
    "/api/categories",
    fetcher,
    {
      keepPreviousData: true,
    },
  );

  if (error) {
    console.error("[User Categories] Fetch failed", error);
  }

  return { data, isLoading, mutate };
}

/**
 * Hook to get preset templates
 */
function useCategoryTemplates() {
  const { data, isLoading, error } = useSWR<TemplatesResponse>(
    "/api/categories/templates",
    fetcher,
  );

  if (error) {
    console.error("[Category Templates] Fetch failed", error);
  }

  return { data, isLoading };
}

/**
 * "My Contexts" component
 * Supports user create/edit/delete of context categories
 */
export function PersonalizationContextsSettings() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useUserCategories();
  const { data: templatesData } = useCategoryTemplates();

  /** Right sidebar for adding context: shows create form card + template contexts group when opened */
  const [isAddSidebarOpen, setIsAddSidebarOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UserCategory | null>(
    null,
  );
  const [deletingCategory, setDeletingCategory] = useState<UserCategory | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Drag state
  const [draggedCategory, setDraggedCategory] = useState<UserCategory | null>(
    null,
  );
  const [dragOverCategory, setDragOverCategory] = useState<UserCategory | null>(
    null,
  );

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const categories = data?.categories ?? [];
  const templates = templatesData?.templates ?? [];

  /**
   * Validates category name
   */
  const validateName = useCallback(
    (name: string, excludeId?: string) => {
      if (!name.trim()) {
        setNameError(
          t("settings.categoryNameRequired", "Context name cannot be empty"),
        );
        return false;
      }

      // Check for duplicates (excluding currently edited category)
      const duplicate = categories.find(
        (cat) =>
          cat.name.toLowerCase() === name.toLowerCase().trim() &&
          cat.id !== excludeId,
      );

      if (duplicate) {
        setNameError(
          t(
            "settings.categoryNameDuplicate",
            "Context name already exists, please use a different name",
          ),
        );
        return false;
      }

      setNameError(null);
      return true;
    },
    [categories, t],
  );

  /**
   * Reset form
   */
  const resetForm = useCallback(() => {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setNameError(null);
    setEditingCategory(null);
  }, []);

  /**
   * Opens right sidebar (create form + template contexts)
   */
  const handleAddContextClick = useCallback(() => {
    resetForm();
    setIsAddSidebarOpen(true);
  }, [resetForm]);

  /**
   * Create category from template
   */
  const handleCreateFromTemplate = useCallback(
    async (template: CategoryTemplate) => {
      setIsSaving(true);
      try {
        const payload: CategoryCreatePayload = {
          name: template.name,
          description: template.description,
          templateName: template.name,
        };

        const response = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create category");
        }

        await mutate();
        // Update all SWR cache using this key (including sidebar)
        await globalMutate("/api/categories");
        // Also refresh category stats (matching all timeFilter parameter requests)
        await globalMutate(
          (key) =>
            typeof key === "string" && key.startsWith("/api/categories/stats"),
        );
        // Don't close sidebar when adding from template, to allow continuous adding
        toast({
          type: "success",
          description: t("settings.categoryCreated"),
        });
      } catch (error) {
        console.error("[Categories] Failed to create from template", error);
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("settings.categoryCreated"),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [mutate, t],
  );

  /**
   * Create category
   */
  const handleCreate = useCallback(async () => {
    if (!validateName(formName)) {
      return;
    }

    setIsSaving(true);
    try {
      const payload: CategoryCreatePayload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        isActive: formIsActive,
      };

      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }

      await mutate();
      // Update all SWR cache using this key (including sidebar)
      await globalMutate("/api/categories");
      // Also refresh category stats (matching all timeFilter parameter requests)
      await globalMutate(
        (key) =>
          typeof key === "string" && key.startsWith("/api/categories/stats"),
      );
      setIsAddSidebarOpen(false);
      resetForm();
      toast({
        type: "success",
        description: t("settings.categoryCreated"),
      });
    } catch (error) {
      console.error("[Categories] Failed to create", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to create category",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    formName,
    formDescription,
    formIsActive,
    validateName,
    mutate,
    resetForm,
    t,
  ]);

  /**
   * Opens edit dialog
   */
  const handleEditClick = useCallback((category: UserCategory) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormDescription(category.description || "");
    setFormIsActive(category.isActive);
    setNameError(null);
    setIsEditDialogOpen(true);
  }, []);

  /**
   * Update category
   */
  const handleUpdate = useCallback(async () => {
    if (!editingCategory) return;
    if (!validateName(formName, editingCategory.id)) {
      return;
    }

    setIsSaving(true);
    try {
      const payload: CategoryUpdatePayload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        isActive: formIsActive,
      };

      const response = await fetch(`/api/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      await mutate();
      // Update all SWR cache using this key (including sidebar)
      await globalMutate("/api/categories");
      // Also refresh category stats (matching all timeFilter parameter requests)
      await globalMutate(
        (key) =>
          typeof key === "string" && key.startsWith("/api/categories/stats"),
      );
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        type: "success",
        description: t("settings.categoryUpdated"),
      });
    } catch (error) {
      console.error("[Categories] Failed to update", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to update category",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    editingCategory,
    formName,
    formDescription,
    formIsActive,
    validateName,
    mutate,
    resetForm,
    t,
  ]);

  /**
   * Opens delete confirmation dialog
   */
  const handleDeleteClick = useCallback((category: UserCategory) => {
    setDeletingCategory(category);
    setIsDeleteDialogOpen(true);
  }, []);

  /**
   * Delete category
   */
  const handleDelete = useCallback(async () => {
    if (!deletingCategory) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/categories/${deletingCategory.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }

      await mutate();
      // Update all SWR cache using this key (including sidebar)
      await globalMutate("/api/categories");
      // Also refresh category stats (matching all timeFilter parameter requests)
      await globalMutate(
        (key) =>
          typeof key === "string" && key.startsWith("/api/categories/stats"),
      );
      setIsDeleteDialogOpen(false);
      setDeletingCategory(null);
      toast({
        type: "success",
        description: t("settings.categoryDeleted"),
      });
    } catch (error) {
      console.error("[Categories] Failed to delete", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to delete category",
      });
    } finally {
      setIsSaving(false);
    }
  }, [deletingCategory, mutate, t]);

  /**
   * Toggle category enabled status
   */
  const handleToggleActive = useCallback(
    async (category: UserCategory) => {
      try {
        const payload: CategoryUpdatePayload = {
          isActive: !category.isActive,
        };

        const response = await fetch(`/api/categories/${category.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to update category");
        }

        await mutate();
        // Update all SWR cache using this key (including sidebar)
        await globalMutate("/api/categories");
      } catch (error) {
        console.error("[Categories] Failed to toggle active", error);
        toast({
          type: "error",
          description: "Failed to update category",
        });
      }
    },
    [mutate],
  );

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((category: UserCategory) => {
    setDraggedCategory(category);
  }, []);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setDraggedCategory(null);
    setDragOverCategory(null);
  }, []);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent, category: UserCategory) => {
      if (!draggedCategory || draggedCategory.id === category.id) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverCategory(category);
    },
    [draggedCategory],
  );

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback(() => {
    setDragOverCategory(null);
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback(
    async (e: React.DragEvent, targetCategory: UserCategory) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedCategory || draggedCategory.id === targetCategory.id) {
        setDraggedCategory(null);
        setDragOverCategory(null);
        return;
      }

      // Reorder
      const newCategories = [...categories];
      const draggedIndex = newCategories.findIndex(
        (cat) => cat.id === draggedCategory.id,
      );
      const targetIndex = newCategories.findIndex(
        (cat) => cat.id === targetCategory.id,
      );

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedCategory(null);
        setDragOverCategory(null);
        return;
      }

      const [removed] = newCategories.splice(draggedIndex, 1);
      newCategories.splice(targetIndex, 0, removed);

      // Optimistic update: update frontend state immediately
      const optimisticData = { categories: newCategories };
      mutate(optimisticData, false);

      // Clear drag state
      setDraggedCategory(null);
      setDragOverCategory(null);

      // Save new order to server
      try {
        const response = await fetch("/api/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: newCategories.map((cat, index) => ({
              id: cat.id,
              sortOrder: index,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to reorder categories");
        }

        // On success, update all cache (including AppSidebar)
        await globalMutate(
          (key) => typeof key === "string" && key.startsWith("/api/categories"),
        );
        toast({
          type: "success",
          description: t("settings.categoryReordered", "Sort order updated"),
        });
      } catch (error) {
        console.error("[Categories] Failed to reorder", error);
        // Rollback to original state on failure
        await mutate();
        toast({
          type: "error",
          description: t("settings.reorderFailed", "Sort failed, rolled back"),
        });
      }
    },
    [draggedCategory, categories, mutate, t],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RemixIcon
          name="loader_2"
          size="size-6"
          className="animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  return (
    <>
      <TwoPaneSidebarLayout
        isSidebarOpen={isAddSidebarOpen}
        breakpoint="lg"
        className="!px-0"
        mainClassName="min-w-0"
        sidebar={
          <div className="flex flex-col min-h-0 h-full">
            <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0">
              <h2 className="text-sm font-semibold font-serif text-foreground">
                {t("settings.addNewContext", "Add new context")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setIsAddSidebarOpen(false)}
                aria-label={t("common.close", "Close")}
              >
                <RemixIcon name="close" size="size-4" />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-0 pb-4 pr-4">
              <section className="flex flex-col gap-3 pb-4">
                {/* Create context form card: style consistent with RssAddControls */}
                <div className="flex flex-col gap-4 rounded-2xl border border-[#e5e5e5] bg-white p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs font-medium text-[#6f6e69]"
                        htmlFor="sidebar-create-name"
                      >
                        {t("settings.categoryName", "Context name")}
                      </Label>
                      <Input
                        id="sidebar-create-name"
                        value={formName}
                        onChange={(e) => {
                          setFormName(e.target.value);
                          validateName(e.target.value);
                        }}
                        placeholder={t(
                          "settings.categoryNamePlaceholder",
                          "For example: News, Meetings",
                        )}
                        className={cn(nameError && "border-destructive")}
                      />
                      {nameError && (
                        <p className="text-xs text-destructive">{nameError}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs font-medium text-[#6f6e69]"
                        htmlFor="sidebar-create-description"
                      >
                        {t(
                          "settings.categoryDescription",
                          "Context description",
                        )}
                      </Label>
                      <Textarea
                        id="sidebar-create-description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder={t(
                          "settings.categoryDescriptionPlaceholder",
                          "Describe the meaning of this category in natural language, and AI will automatically categorize related insights here based on your description",
                        )}
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label
                        className="text-xs font-medium text-[#6f6e69]"
                        htmlFor="sidebar-create-active"
                      >
                        {t("settings.enableCategory", "Enable context")}
                      </Label>
                      <Switch
                        id="sidebar-create-active"
                        checked={formIsActive}
                        onCheckedChange={setFormIsActive}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="self-start gap-1.5"
                      onClick={handleCreate}
                      disabled={isSaving || !!nameError || !formName.trim()}
                    >
                      {isSaving ? (
                        <>
                          <RemixIcon
                            name="loader_2"
                            size="size-4"
                            className="animate-spin"
                          />
                          {t("common.saving", "Saving")}
                        </>
                      ) : (
                        <>
                          <RemixIcon name="add" size="size-4" />
                          {t("common.add", "Add")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </section>

              {/* Template contexts group */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("settings.templateContexts", "Template contexts")}
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {templates.map((template) => {
                    const alreadyExists = categories.some(
                      (cat) =>
                        cat.name.toLowerCase() === template.name.toLowerCase(),
                    );
                    return (
                      <div
                        key={template.name}
                        role="button"
                        tabIndex={alreadyExists ? -1 : 0}
                        className={cn(
                          "group flex items-stretch rounded-2xl border border-[#e5e5e5] bg-white cursor-pointer transition-colors hover:bg-[#f5f5f5]",
                          alreadyExists &&
                            "opacity-50 cursor-not-allowed hover:bg-white",
                        )}
                        onClick={() => {
                          if (!alreadyExists) {
                            handleCreateFromTemplate(template);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            !alreadyExists &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            handleCreateFromTemplate(template);
                          }
                        }}
                      >
                        <div className="flex flex-1 flex-col min-w-0 gap-2 p-4 pr-0">
                          <span className="text-sm font-semibold font-serif block mb-0">
                            {t(
                              `settings.contextTemplates.${template.name}.name`,
                              template.name,
                            )}
                          </span>
                          <p className="text-xs text-[#6f6e69]">
                            {t(
                              `settings.contextTemplates.${template.name}.description`,
                            )}
                          </p>
                          {alreadyExists && (
                            <p className="text-xs text-destructive mt-2">
                              {t(
                                "settings.categoryNameDuplicate",
                                "Context already exists",
                              )}
                            </p>
                          )}
                        </div>
                        {!alreadyExists && (
                          <div className="flex items-center pr-3 sm:pr-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                              tabIndex={-1}
                              aria-hidden
                            >
                              <RemixIcon name="add" size="size-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        }
      >
        <div className="space-y-6 py-6 px-8 flex-1 min-h-0 overflow-y-auto">
          <div className="mb-2">
            <p className="text-xs text-[#6f6e69] w-full">
              {t(
                "settings.contextsDescription",
                "Select the contexts you care about, and Alloomi will automatically categorize events into the corresponding categories, allowing you to switch perspectives and focus on what matters most.",
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleAddContextClick}
            >
              <RemixIcon name="add" size="size-4" />
              <span className="hidden sm:inline">
                {t("settings.addNewContext", "Add new context")}
              </span>
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t(
                "settings.noCategories",
                "No contexts yet, please add a context",
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {t("settings.contextsListTitle", "Contexts")}{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    ({categories.length})
                  </span>
                </span>
              </div>
              <div className="space-y-4">
                {categories.map((category) => {
                  const isDragging = draggedCategory?.id === category.id;
                  const isDragOver = dragOverCategory?.id === category.id;

                  return (
                    <div
                      key={category.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={() => handleDragStart(category)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, category)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, category)}
                      className={cn(
                        "flex items-center gap-3 py-4 px-4 rounded-lg border",
                        "bg-background hover:bg-muted/50 transition-colors",
                        !category.isActive && "opacity-50",
                        isDragging && "opacity-50",
                        isDragOver && "bg-primary/10 border-primary",
                        "cursor-move",
                      )}
                    >
                      <RemixIcon
                        name="grip_vertical"
                        size="size-4"
                        className="text-muted-foreground"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold font-serif">
                              {t(
                                `settings.contextTemplates.${category.name}.name`,
                                category.name,
                              )}
                            </span>
                            {!category.isActive && (
                              <Badge variant="outline" className="text-xs">
                                {t("settings.disableCategory", "Disabled")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(category);
                              }}
                            >
                              <RemixIcon name="edit" size="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(category);
                              }}
                            >
                              <RemixIcon name="delete_bin" size="size-4" />
                            </Button>
                            <Switch
                              checked={category.isActive}
                              onCheckedChange={() =>
                                handleToggleActive(category)
                              }
                            />
                          </div>
                        </div>
                        {(() => {
                          const desc = t(
                            `settings.contextTemplates.${category.name}.description`,
                            category.description ?? "",
                          );
                          return desc ? (
                            <p className="text-xs text-muted-foreground">
                              {desc}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </TwoPaneSidebarLayout>

      {/* Edit category dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="!z-[1100]" overlayClassName="!z-[1099]">
          <DialogHeader>
            <DialogTitle>
              {t("settings.editCategory", "Edit context")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">
                {t("settings.categoryName", "Context name")}
              </Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  validateName(e.target.value, editingCategory?.id);
                }}
                placeholder={t(
                  "settings.categoryNamePlaceholder",
                  "For example: News, Meetings",
                )}
                className={cn(nameError && "border-destructive")}
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1">{nameError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-description">
                {t("settings.categoryDescription", "Context description")}
              </Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t(
                  "settings.categoryDescriptionPlaceholder",
                  "Describe the meaning of this category in natural language, and AI will automatically categorize related insights here based on your description",
                )}
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">
                {t("settings.enableCategory", "Enable context")}
              </Label>
              <Switch
                id="edit-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSaving || !!nameError || !formName.trim()}
            >
              {isSaving ? (
                <>
                  <RemixIcon
                    name="loader_2"
                    size="size-4"
                    className="mr-2 animate-spin"
                  />
                  {t("common.saving", "Saving")}
                </>
              ) : (
                t("common.save", "Save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="!z-[1100]" overlayClassName="!z-[1099]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.deleteCategory", "Delete category")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory
                ? t(
                    "settings.confirmDeleteCategory",
                    "Are you sure you want to delete the category {{name}}?",
                    {
                      name: t(
                        `settings.contextTemplates.${deletingCategory.name}.name`,
                        deletingCategory.name,
                      ),
                    },
                  )
                : t(
                    "settings.confirmDeleteCategoryAny",
                    "Are you sure you want to delete this category?",
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? (
                <>
                  <RemixIcon
                    name="loader_2"
                    size="size-4"
                    className="mr-2 animate-spin"
                  />
                  {t("common.deleting", "Deleting")}
                </>
              ) : (
                t("common.delete", "Delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
