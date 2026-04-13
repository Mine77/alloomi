"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import useSWR, { mutate as globalMutate } from "swr";
import { RemixIcon } from "@/components/remix-icon";
import { Button, Input, Label, Textarea } from "@alloomi/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@alloomi/ui";
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
import { OnboardingStepLayout } from "./onboarding-step-layout";
import type {
  UserCategory,
  CategoryTemplate,
  CategoryCreatePayload,
  CategoryUpdatePayload,
} from "@/lib/types/categories";

/**
 * Category list response
 */
type CategoriesResponse = {
  categories: UserCategory[];
};

/**
 * Template list response
 */
type TemplatesResponse = {
  templates: CategoryTemplate[];
};

/**
 * Onboarding context selection step component props
 */
interface OnboardingPainPointsStepProps {
  /** Currently selected context ID list (uses painPoints field for compatibility) */
  painPoints: string[];
  /** Custom pain points list (kept for compatibility, no longer used) */
  customPainPoints: string[];
  /** Context change handler (uses painPoints field for compatibility) */
  onPainPointsChange: (painPoints: string[]) => void;
  /** Custom pain points change handler (kept for compatibility, no longer used) */
  onCustomPainPointsChange: (painPoints: string[]) => void;
  /** Back handler */
  onBack: () => void;
  /** Submit handler */
  onSubmit: () => void;
  /** Whether submitting */
  isSubmitting?: boolean;
  /** Whether to show back button (can be set to false in standalone dialog) */
  showBack?: boolean;
  /** Override layout title i18n key (optional) */
  titleKey?: string;
  /** Override layout subtitle i18n key (optional) */
  subtitleKey?: string;
  /** Complete button text i18n key (optional) */
  actionButtonTextKey?: string;
}

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
 * Onboarding context selection step component
 * Lets user select contexts to follow, supports add, edit, and create contexts
 */
export function OnboardingContextStep({
  painPoints,
  customPainPoints,
  onPainPointsChange,
  onCustomPainPointsChange,
  onBack,
  onSubmit,
  isSubmitting = false,
  showBack = true,
  titleKey: titleKeyProp,
  subtitleKey: subtitleKeyProp,
  actionButtonTextKey,
}: OnboardingPainPointsStepProps) {
  const { t } = useTranslation();
  const layoutTitle = titleKeyProp
    ? t(titleKeyProp)
    : t("onboarding.painPoints.title");
  const layoutSubtitle = subtitleKeyProp
    ? t(subtitleKeyProp)
    : t("onboarding.painPoints.subtitle");
  const actionButtonText = actionButtonTextKey
    ? t(actionButtonTextKey)
    : t("onboarding.painPoints.nextButton", "Next");
  const { data, isLoading, mutate } = useUserCategories();
  const { data: templatesData } = useCategoryTemplates();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UserCategory | null>(
    null,
  );
  const [deletingCategory, setDeletingCategory] = useState<UserCategory | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const categories = data?.categories ?? [];
  const templates = templatesData?.templates ?? [];
  const selectedContextIds = painPoints; // Use painPoints as selected context ID list

  /**
   * Validate category name
   */
  const validateName = useCallback(
    (name: string, excludeId?: string) => {
      if (!name.trim()) {
        setNameError(
          t("settings.categoryNameRequired", "Context name cannot be empty"),
        );
        return false;
      }

      // Check for duplicate names (excluding currently edited category)
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
    setNameError(null);
    setEditingCategory(null);
  }, []);

  /**
   * Open create dialog
   */
  const handleCreateClick = useCallback(() => {
    resetForm();
    setIsCreateDialogOpen(true);
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
          isActive: true,
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
        // Update all SWR caches using this key
        await globalMutate("/api/categories");
        setIsTemplateDialogOpen(false);

        toast({
          type: "success",
          description: t("settings.categoryCreated", "Context created"),
        });
      } catch (error) {
        console.error("[Categories] Failed to create from template", error);
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("settings.categoryCreated", "Creation failed"),
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
        isActive: true,
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
      // Update all SWR caches using this key
      await globalMutate("/api/categories");
      setIsCreateDialogOpen(false);
      resetForm();

      toast({
        type: "success",
        description: t("settings.categoryCreated", "Context created"),
      });
    } catch (error) {
      console.error("[Categories] Failed to create", error);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : t("settings.categoryCreated", "Creation failed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    formName,
    formDescription,
    validateName,
    mutate,
    resetForm,
    t,
    selectedContextIds,
    onPainPointsChange,
  ]);

  /**
   * Open edit dialog
   */
  const handleEditClick = useCallback(
    (category: UserCategory, event?: React.MouseEvent) => {
      // Stop event propagation to avoid triggering selection
      if (event) {
        event.stopPropagation();
      }
      setEditingCategory(category);
      setFormName(category.name);
      setFormDescription(category.description || "");
      setNameError(null);
      setIsEditDialogOpen(true);
    },
    [],
  );

  /**
   * Open delete confirmation dialog
   */
  const handleDeleteClick = useCallback(
    (category: UserCategory, event?: React.MouseEvent) => {
      // Stop event propagation to avoid triggering selection
      if (event) {
        event.stopPropagation();
      }
      setDeletingCategory(category);
      setIsDeleteDialogOpen(true);
    },
    [],
  );

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

      // If deleted category was selected, remove from selection list
      if (selectedContextIds.includes(deletingCategory.id)) {
        onPainPointsChange(
          selectedContextIds.filter((id) => id !== deletingCategory.id),
        );
      }

      await mutate();
      // Update all SWR caches using this key
      await globalMutate("/api/categories");
      // Also refresh category stats
      await globalMutate(
        (key) =>
          typeof key === "string" && key.startsWith("/api/categories/stats"),
      );
      setIsDeleteDialogOpen(false);
      setDeletingCategory(null);
      toast({
        type: "success",
        description: t("settings.categoryDeleted", "Context deleted"),
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
  }, [deletingCategory, mutate, t, selectedContextIds, onPainPointsChange]);

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
      // Update all SWR caches using this key
      await globalMutate("/api/categories");
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        type: "success",
        description: t("settings.categoryUpdated", "Context updated"),
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
    validateName,
    mutate,
    resetForm,
    t,
  ]);

  /**
   * Toggle context selection state
   */
  const handleToggleContext = useCallback(
    (categoryId: string) => {
      if (selectedContextIds.includes(categoryId)) {
        // Deselect
        onPainPointsChange(
          selectedContextIds.filter((id) => id !== categoryId),
        );
      } else {
        // Select
        onPainPointsChange([...selectedContextIds, categoryId]);
      }
    },
    [selectedContextIds, onPainPointsChange],
  );

  /**
   * Handle submit
   */
  const handleSubmit = () => {
    onSubmit();
  };

  if (isLoading) {
    return (
      <OnboardingStepLayout
        title={layoutTitle}
        subtitle={layoutSubtitle}
        showBack={showBack}
        onBack={onBack}
        actionButtonText={actionButtonText}
        onAction={handleSubmit}
        actionButtonDisabled={isSubmitting}
        isSubmitting={isSubmitting}
        submittingText={t(
          "onboarding.painPoints.generating",
          "Generating your avatar...",
        )}
        contentClassName="space-y-10"
      >
        <div className="flex items-center justify-center py-8">
          <RemixIcon
            name="loader_2"
            size="size-6"
            className="animate-spin text-muted-foreground"
          />
        </div>
      </OnboardingStepLayout>
    );
  }

  return (
    <OnboardingStepLayout
      title={layoutTitle}
      subtitle={layoutSubtitle}
      showBack={showBack}
      onBack={onBack}
      actionButtonText={actionButtonText}
      onAction={handleSubmit}
      actionButtonDisabled={isSubmitting}
      isSubmitting={isSubmitting}
      submittingText={t(
        "onboarding.painPoints.generating",
        "Generating your avatar...",
      )}
      contentClassName="space-y-6"
    >
      {/* Context card list */}
      <section className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3">
          {/* Create new scenario card */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleCreateClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleCreateClick();
              }
            }}
            className="rounded-2xl border border-dashed bg-background/70 p-5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer hover:border-primary/40 hover:bg-muted/50 h-[120px] flex items-center justify-center"
          >
            <div className="flex items-center gap-2 w-full justify-center">
              <RemixIcon
                name="add"
                size="size-6"
                className="text-muted-foreground shrink-0"
              />
              <h4 className="text-base font-semibold text-muted-foreground line-clamp-2">
                {t("onboarding.painPoints.createNewContext", "Add new context")}
              </h4>
            </div>
          </div>

          {/* Context card */}
          {categories.map((category) => {
            const isSelected = selectedContextIds.includes(category.id);
            return (
              <div
                key={category.id}
                role="button"
                tabIndex={0}
                onClick={() => handleToggleContext(category.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleToggleContext(category.id);
                  }
                }}
                className={cn(
                  "rounded-2xl border bg-background/70 p-5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer relative h-[120px] flex flex-col",
                  isSelected
                    ? "border-primary/40 bg-primary/5"
                    : "hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-4 flex-1 min-h-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2.5">
                      <h4 className="text-base font-semibold line-clamp-1">
                        {category.name}
                      </h4>
                      {isSelected && (
                        <RemixIcon
                          name="check"
                          size="size-4"
                          className="text-primary shrink-0"
                        />
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                {/* Edit button */}
                <button
                  type="button"
                  onClick={(e) => handleEditClick(category, e)}
                  className="absolute top-3.5 right-3.5 p-1.5 rounded-md hover:bg-muted transition-colors"
                  aria-label={t("common.edit", "Edit")}
                >
                  <RemixIcon
                    name="edit"
                    size="size-3.5"
                    className="text-muted-foreground"
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Create context dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent
          className="!z-[1100] max-w-md !p-8"
          overlayClassName="!z-[1099]"
        >
          <DialogHeader className="pb-4">
            <DialogTitle>
              {t("settings.createCategory", "Create context")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="create-name" className="text-sm font-medium">
                {t("settings.categoryName", "Context name")}
              </Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  validateName(e.target.value);
                }}
                placeholder={t(
                  "settings.categoryNamePlaceholder",
                  "e.g. Work, Life",
                )}
                className={cn(nameError && "border-destructive mt-1.5")}
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1.5">{nameError}</p>
              )}
            </div>
            <div>
              <Label
                htmlFor="create-description"
                className="text-sm font-medium"
              >
                {t("settings.categoryDescription", "Context description")}
              </Label>
              <Textarea
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t(
                  "settings.categoryDescriptionPlaceholder",
                  "Describe this context naturally — Alloomi uses it to automatically sort related insights into this context",
                )}
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-center pt-2 pb-1">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsTemplateDialogOpen(true);
              }}
            >
              <RemixIcon name="file_list_3" size="size-4" className="mr-2" />
              {t("onboarding.painPoints.addFromTemplate", "Add from template")}
            </Button>
          </div>
          <DialogFooter className="gap-2 pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreate}
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

      {/* Add from template dialog */}
      <Dialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
      >
        <DialogContent
          className="max-w-2xl !z-[1100] max-h-[80vh] !p-12"
          overlayClassName="!z-[1099]"
        >
          <DialogHeader className="!pb-10">
            <DialogTitle className="!text-xl">
              {t("settings.selectTemplate", "Select template")}
            </DialogTitle>
          </DialogHeader>

          <div className="!py-6 !px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 !gap-x-10 !gap-y-8 max-h-[50vh] overflow-y-auto">
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
                      "flex flex-col !p-8 rounded-xl border cursor-pointer transition-colors",
                      alreadyExists
                        ? "bg-muted opacity-50 cursor-not-allowed"
                        : "bg-background hover:bg-muted/50",
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
                    <div className="flex items-center justify-between !mb-4">
                      <span className="text-base font-semibold">
                        {t(
                          `settings.contextTemplates.${template.name}.name`,
                          template.name,
                        )}
                      </span>
                    </div>
                    <p className="text-base text-muted-foreground !leading-relaxed">
                      {t(
                        `settings.contextTemplates.${template.name}.description`,
                        template.description,
                      )}
                    </p>
                    {alreadyExists && (
                      <p className="text-sm text-destructive !mt-4">
                        {t(
                          "settings.categoryNameDuplicate",
                          "Context already exists",
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="!pt-10">
            <Button
              variant="outline"
              onClick={() => setIsTemplateDialogOpen(false)}
              className="!px-8"
            >
              {t("common.cancel", "Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit context dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className="!z-[1100] max-w-md !p-8"
          overlayClassName="!z-[1099]"
        >
          <DialogHeader className="pb-4">
            <DialogTitle>
              {t("settings.editCategory", "Edit context")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="edit-name" className="text-sm font-medium">
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
                  "e.g. Work, Life",
                )}
                className={cn(nameError && "border-destructive mt-1.5")}
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1.5">{nameError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-description" className="text-sm font-medium">
                {t("settings.categoryDescription", "Context description")}
              </Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t(
                  "settings.categoryDescriptionPlaceholder",
                  "Describe this context naturally — Alloomi uses it to automatically sort related insights into this context",
                )}
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-6">
            <div className="flex-1 flex justify-start">
              <Button
                variant="destructive"
                onClick={() => {
                  if (editingCategory) {
                    handleDeleteClick(editingCategory);
                    setIsEditDialogOpen(false);
                  }
                }}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                <RemixIcon name="delete_bin" size="size-4" className="mr-2" />
                {t("common.delete", "Delete")}
              </Button>
            </div>
            <div className="flex gap-2">
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
            </div>
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
              {t("settings.deleteCategory", "Delete context")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory
                ? t(
                    "settings.confirmDeleteCategory",
                    "Are you sure you want to delete the context {{name}}?",
                    {
                      name: deletingCategory.name,
                    },
                  )
                : "Are you sure you want to delete this context?"}
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
    </OnboardingStepLayout>
  );
}
