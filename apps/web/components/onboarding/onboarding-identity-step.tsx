"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@alloomi/ui";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@alloomi/ui";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/**
 * Industry options (with emoji)
 */
const INDUSTRY_OPTIONS = [
  {
    value: "IT/Technology",
    labelKey: "survey.step1.q1.options.it",
    emoji: "💻",
  },
  {
    value: "Finance/Investment",
    labelKey: "survey.step1.q1.options.finance",
    emoji: "💰",
  },
  {
    value: "Education/Training",
    labelKey: "survey.step1.q1.options.education",
    emoji: "📚",
  },
  {
    value: "Media/Advertising",
    labelKey: "survey.step1.q1.options.media",
    emoji: "📺",
  },
  {
    value: "E-commerce/Retail",
    labelKey: "survey.step1.q1.options.retail",
    emoji: "🛒",
  },
  {
    value: "Logistics/Supply Chain",
    labelKey: "survey.step1.q1.options.logistics",
    emoji: "🚚",
  },
  {
    value: "Consulting/Professional Services",
    labelKey: "survey.step1.q1.options.consulting",
    emoji: "💼",
  },
  {
    value: "Gaming/Entertainment",
    labelKey: "survey.step1.q1.options.gaming",
    emoji: "🎮",
  },
  {
    value: "Healthcare",
    labelKey: "survey.step1.q1.options.healthcare",
    emoji: "🏥",
  },
  {
    value: "Real Estate",
    labelKey: "survey.step1.q1.options.realEstate",
    emoji: "🏠",
  },
  {
    value: "Manufacturing",
    labelKey: "survey.step1.q1.options.manufacturing",
    emoji: "🏭",
  },
  { value: "Energy", labelKey: "survey.step1.q1.options.energy", emoji: "⚡" },
  {
    value: "Agriculture",
    labelKey: "survey.step1.q1.options.agriculture",
    emoji: "🌾",
  },
  {
    value: "Travel/Tourism",
    labelKey: "survey.step1.q1.options.travel",
    emoji: "✈️",
  },
  {
    value: "Food & Beverage",
    labelKey: "survey.step1.q1.options.food",
    emoji: "🍔",
  },
  { value: "Other", labelKey: "survey.shared.other", emoji: "➕" },
] as const;

/**
 * Role options
 */
const ROLE_OPTIONS = [
  { value: "executive", labelKey: "survey.step1.q2.options.executive" },
  {
    value: "product_manager",
    labelKey: "survey.step1.q2.options.productManager",
  },
  { value: "engineer", labelKey: "survey.step1.q2.options.engineer" },
  { value: "designer", labelKey: "survey.step1.q2.options.designer" },
  { value: "marketing", labelKey: "survey.step1.q2.options.marketing" },
  { value: "ops", labelKey: "survey.step1.q2.options.ops" },
  { value: "sales_bizdev", labelKey: "survey.step1.q2.options.globalSales" },
  {
    value: "customer_success",
    labelKey: "survey.step1.q2.options.customerSuccess",
  },
  { value: "community_manager", labelKey: "survey.step1.q2.options.community" },
  { value: "remote_worker", labelKey: "survey.step1.q2.options.remoteWorker" },
  { value: "indie_maker", labelKey: "survey.step1.q2.options.indieMaker" },
  { value: "founder", labelKey: "survey.step1.q2.options.founder" },
  { value: "analyst", labelKey: "survey.step1.q2.options.analyst" },
  { value: "journalist", labelKey: "survey.step1.q2.options.journalist" },
  { value: "freelancer", labelKey: "survey.step1.q2.options.freelancer" },
  { value: "investor", labelKey: "survey.step1.q2.options.investor" },
  { value: "advisor", labelKey: "survey.step1.q2.options.advisor" },
  { value: "info_manager", labelKey: "survey.step1.q2.options.infoManager" },
  {
    value: "knowledge_worker",
    labelKey: "survey.step1.q2.options.knowledgeWorker",
  },
  {
    value: "data_scientist",
    labelKey: "survey.step1.q2.options.dataScientist",
  },
  {
    value: "content_creator",
    labelKey: "survey.step1.q2.options.contentCreator",
  },
  { value: "other", labelKey: "survey.shared.other" },
] as const;

/**
 * Onboarding identity definition step component props
 */
interface OnboardingIdentityStepProps {
  /** Currently selected industry list */
  industries: string[];
  /** Other industry list */
  otherIndustries: string[];
  /** Role list */
  roles: string[];
  /** Other role list */
  otherRoles: string[];
  /** Industry change handler */
  onIndustriesChange: (industries: string[]) => void;
  /** Other industry change handler */
  onOtherIndustriesChange: (industries: string[]) => void;
  /** Role change handler */
  onRolesChange: (roles: string[]) => void;
  /** Other role change handler */
  onOtherRolesChange: (roles: string[]) => void;
  /** Previous step handler */
  onBack: () => void;
  /** Next step handler */
  onNext: () => void;
}

type ActivePicker = "industry" | "role" | null;

/**
 * Onboarding identity definition step component
 * Collects user industry and role in the form of "I am a ___ in the ___ industry"
 */
export function OnboardingIdentityStep({
  industries,
  otherIndustries,
  roles,
  otherRoles,
  onIndustriesChange,
  onOtherIndustriesChange,
  onRolesChange,
  onOtherRolesChange,
  onBack,
  onNext,
}: OnboardingIdentityStepProps) {
  const { t } = useTranslation();
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [industryInput, setIndustryInput] = useState("");
  const [roleInput, setRoleInput] = useState("");

  /**
   * Get industry label text
   */
  const getIndustryLabel = (value: string) => {
    const option = INDUSTRY_OPTIONS.find((item) => item.value === value);
    return option ? t(option.labelKey) : value;
  };

  /**
   * Get role label text
   */
  const getRoleLabel = (value: string) => {
    const option = ROLE_OPTIONS.find((item) => item.value === value);
    return option ? t(option.labelKey) : value;
  };

  /**
   * Toggle industry selection
   */
  const toggleIndustry = (value: string) => {
    const next = industries.includes(value)
      ? industries.filter((item) => item !== value)
      : [...industries, value];
    onIndustriesChange(next);
  };

  /**
   * Toggle role selection
   */
  const toggleRole = (value: string) => {
    const next = roles.includes(value)
      ? roles.filter((item) => item !== value)
      : [...roles, value];
    onRolesChange(next);
  };

  const hasIndustrySelection =
    industries.filter((i) => i !== "Other").length > 0 ||
    otherIndustries.length > 0;
  const hasRoleSelection =
    roles.filter((r) => r !== "other").length > 0 || otherRoles.length > 0;
  const canContinue = hasIndustrySelection && hasRoleSelection;

  const industryTags = [
    ...industries
      .filter((value) => value !== "Other")
      .map((value) => ({
        key: value,
        label: getIndustryLabel(value),
        onRemove: () => toggleIndustry(value),
      })),
    ...otherIndustries.map((value) => ({
      key: `custom-${value}`,
      label: value,
      onRemove: () =>
        onOtherIndustriesChange(
          otherIndustries.filter((item) => item !== value),
        ),
    })),
  ];

  const roleTags = [
    ...roles
      .filter((value) => value !== "other")
      .map((value) => ({
        key: value,
        label: getRoleLabel(value),
        onRemove: () => toggleRole(value),
      })),
    ...otherRoles.map((value) => ({
      key: `custom-${value}`,
      label: value,
      onRemove: () =>
        onOtherRolesChange(otherRoles.filter((item) => item !== value)),
    })),
  ];

  const handleAddCustomIndustry = () => {
    const trimmed = industryInput.trim();
    if (trimmed && !otherIndustries.includes(trimmed)) {
      onOtherIndustriesChange([...otherIndustries, trimmed]);
      setIndustryInput("");
    }
  };

  const handleAddCustomRole = () => {
    const trimmed = roleInput.trim();
    if (trimmed && !otherRoles.includes(trimmed)) {
      onOtherRolesChange([...otherRoles, trimmed]);
      setRoleInput("");
    }
  };

  const renderTags = (
    tags: { key: string; label: string; onRemove: () => void }[],
    placeholder: string,
  ) => {
    if (tags.length === 0) {
      return (
        <span className="text-foreground/40 text-base md:text-xl flex-1 text-center">
          {placeholder}
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2 justify-center w-full">
        {tags.map((tag) => (
          <span
            key={tag.key}
            className="inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-base font-semibold text-foreground"
          >
            {tag.label}
            <button
              type="button"
              className="text-muted-foreground transition hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                tag.onRemove();
              }}
            >
              <RemixIcon name="close" size="size-3.5" />
            </button>
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <OnboardingStepLayout
        title={t("onboarding.identity.instruction")}
        subtitle={t("onboarding.identity.description")}
        showBack={true}
        onBack={onBack}
        actionButtonText={t("common.continue")}
        onAction={onNext}
        actionButtonDisabled={!canContinue}
        contentClassName="flex flex-col items-center justify-center gap-6 text-center"
      >
        <div className="text-2xl font-semibold leading-relaxed md:text-3xl">
          <span>{t("onboarding.identity.statementPrefix")}</span>
          <div
            className={cn(
              "mx-2 inline-flex min-w-[160px] items-center gap-2 border-b-[3px] px-1 py-0.5 align-middle transition justify-center",
              activePicker === "industry"
                ? "border-primary text-primary"
                : "border-border text-foreground",
            )}
            onClick={() => setActivePicker("industry")}
            role="button"
          >
            {renderTags(
              industryTags,
              t("onboarding.identity.industryPlaceholder"),
            )}
          </div>
          <span>{t("onboarding.identity.statementConnector")}</span>
          <div
            className={cn(
              "mx-2 inline-flex min-w-[160px] items-center gap-2 border-b-[3px] px-1 py-0.5 align-middle transition justify-center",
              activePicker === "role"
                ? "border-primary text-primary"
                : "border-border text-foreground",
            )}
            onClick={() => setActivePicker("role")}
            role="button"
          >
            {renderTags(roleTags, t("onboarding.identity.rolePlaceholder"))}
          </div>
        </div>
      </OnboardingStepLayout>

      <Dialog
        open={activePicker !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActivePicker(null);
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay className="z-[102]" />
          <DialogPrimitive.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[103] flex flex-col w-full max-w-[calc(100%-2rem)] md:max-w-[480px] max-h-[calc(100vh-4rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200">
            {activePicker && (
              <>
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                  <DialogTitle>
                    {activePicker === "industry"
                      ? t("onboarding.industry.title")
                      : t("onboarding.role.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {activePicker === "industry"
                      ? t("onboarding.industry.subtitle")
                      : t("onboarding.role.subtitle")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6">
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                    {(activePicker === "industry"
                      ? INDUSTRY_OPTIONS.filter((opt) => opt.value !== "Other")
                      : ROLE_OPTIONS.filter((opt) => opt.value !== "other")
                    ).map((option) => {
                      const isSelected =
                        activePicker === "industry"
                          ? industries.includes(option.value)
                          : roles.includes(option.value);
                      const toggle = () =>
                        activePicker === "industry"
                          ? toggleIndustry(option.value)
                          : toggleRole(option.value);

                      return (
                        <button
                          type="button"
                          key={option.value}
                          onClick={toggle}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-4 md:px-4 md:py-3 text-left transition",
                            "hover:border-primary/50 hover:bg-primary/5",
                            isSelected && "border-primary bg-primary/10",
                          )}
                        >
                          <span className="text-sm font-medium">
                            {t(option.labelKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-3 mt-6 mb-6">
                    <div className="flex flex-wrap gap-2">
                      {(activePicker === "industry"
                        ? otherIndustries
                        : otherRoles
                      ).map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() =>
                              activePicker === "industry"
                                ? onOtherIndustriesChange(
                                    otherIndustries.filter(
                                      (value) => value !== item,
                                    ),
                                  )
                                : onOtherRolesChange(
                                    otherRoles.filter(
                                      (value) => value !== item,
                                    ),
                                  )
                            }
                            className="text-muted-foreground transition hover:text-foreground"
                          >
                            <RemixIcon name="close" size="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={
                          activePicker === "industry"
                            ? industryInput
                            : roleInput
                        }
                        onChange={(event) =>
                          activePicker === "industry"
                            ? setIndustryInput(event.target.value)
                            : setRoleInput(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            activePicker === "industry"
                              ? handleAddCustomIndustry()
                              : handleAddCustomRole();
                          }
                        }}
                        placeholder={
                          activePicker === "industry"
                            ? t("onboarding.industry.otherPlaceholder")
                            : t("survey.step1.q2.otherPlaceholder")
                        }
                        className="flex-1 rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          activePicker === "industry"
                            ? handleAddCustomIndustry()
                            : handleAddCustomRole()
                        }
                        disabled={
                          activePicker === "industry"
                            ? !industryInput.trim()
                            : !roleInput.trim()
                        }
                      >
                        {t("common.add")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end px-6 pb-6 pt-6 border-t shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setActivePicker(null);
                    }}
                    disabled={
                      (activePicker === "industry" &&
                        industries.filter((i) => i !== "Other").length === 0 &&
                        otherIndustries.length === 0) ||
                      (activePicker === "role" &&
                        roles.filter((r) => r !== "other").length === 0 &&
                        otherRoles.length === 0)
                    }
                  >
                    {t("onboarding.identity.doneButton", "Complete")}
                  </Button>
                </div>
              </>
            )}
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
              <RemixIcon name="close" size="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
