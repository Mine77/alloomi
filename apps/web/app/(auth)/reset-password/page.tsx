"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { toast } from "@/components/toast";
import { Button, Input, Label } from "@alloomi/ui";

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-11 pr-10"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
        >
          <RemixIcon name={showPassword ? "eye_off" : "eye"} size="size-5" />
        </button>
      </div>
    </div>
  );
}

type PageState = "loading" | "invalid" | "form" | "success";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>(
    token ? "loading" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const hasHandledSuccess = useRef(false);

  // Client-side password validation
  const lengthValid = password.length >= 8 && password.length <= 20;
  const compositionValid = /[A-Za-z]/.test(password) && /\d/.test(password);
  const allValid = lengthValid && compositionValid;

  // Validate token presence on mount
  useEffect(() => {
    if (!token) {
      setPageState("invalid");
    } else {
      setPageState("form");
    }
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasHandledSuccess.current) return;

    // Client-side validation
    if (!allValid) {
      toast({
        type: "error",
        description: t("auth.passwordInvalid"),
      });
      return;
    }

    if (password !== confirmPassword) {
      setMatchError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setMatchError(null);

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "invalid_token") {
          setPageState("invalid");
          toast({ type: "error", description: t("auth.resetInvalidLink") });
        } else if (data.error === "token_expired") {
          setPageState("invalid");
          toast({ type: "error", description: t("auth.resetTokenExpired") });
        } else {
          toast({ type: "error", description: t("auth.resetFailed") });
        }
        return;
      }

      hasHandledSuccess.current = true;
      setIsSuccessful(true);
      setPageState("success");
    } catch (error) {
      console.error("[ResetPassword]", error);
      toast({ type: "error", description: t("auth.resetFailed") });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            <div className="flex items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </div>
        </div>
        <div className="relative hidden lg:flex lg:w-1/2">
          <Image
            src="/images/login.png"
            alt="Alloomi app interface preview"
            fill
            sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            <div className="space-y-3 text-center sm:text-left">
              <div className="flex justify-center sm:justify-start">
                <RemixIcon
                  name="error_warning"
                  size="size-12"
                  className="text-destructive"
                />
              </div>
              <h1 className="font-serif text-[32px] font-semibold text-foreground text-center">
                {t("auth.resetInvalidLink")}
              </h1>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:p-8 space-y-4">
              <p className="text-sm text-foreground/60">
                {t("auth.resetTokenExpired")}
              </p>
              <Button
                variant="default"
                className="h-11 w-full"
                onClick={() => router.push("/")}
              >
                {t("auth.requestAnotherLink")}
              </Button>
              <p className="text-center text-sm text-foreground/60">
                <Link
                  href="/"
                  className="font-semibold text-primary hover:underline"
                >
                  {t("auth.resetBackToLogin")}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="relative hidden lg:flex lg:w-1/2">
          <Image
            src="/images/login.png"
            alt="Alloomi app interface preview"
            fill
            sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <RemixIcon
                  name="checkbox_circle"
                  size="size-12"
                  filled
                  className="text-success"
                />
              </div>
              <h1 className="font-serif text-[32px] font-semibold text-foreground text-center">
                {t("auth.resetSuccessHeading")}
              </h1>
              <p className="text-center text-sm text-foreground/60">
                {t("auth.resetSuccessBody")}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
              <Button
                variant="default"
                className="h-11 w-full"
                onClick={() => router.push("/")}
              >
                {t("auth.resetBackToLogin")}
              </Button>
            </div>
          </div>
        </div>

        <div className="relative hidden lg:flex lg:w-1/2">
          <Image
            src="/images/login.png"
            alt="Alloomi app interface preview"
            fill
            sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-3 text-center sm:text-left">
            <h1 className="font-serif text-[32px] font-semibold text-foreground text-center">
              {t("auth.resetPasswordTitle")}
            </h1>
            <p className="text-sm text-foreground/60 text-center sm:text-left">
              {t("auth.resetPasswordSubtitle")}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField
                id="password"
                label={t("auth.passwordLabel")}
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  if (matchError) setMatchError(null);
                }}
                autoComplete="new-password"
              />

              {/* Password strength checklist */}
              {password.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm">
                  <p className="mb-3 font-medium text-foreground/80">
                    {t("auth.passwordRequirements")}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      {lengthValid ? (
                        <RemixIcon
                          name="checkbox_circle"
                          size="size-4"
                          filled
                          className="text-success"
                        />
                      ) : (
                        <RemixIcon
                          name="checkbox_blank"
                          size="size-4"
                          className="text-foreground/40"
                        />
                      )}
                      <span
                        className={`${lengthValid ? "text-foreground" : "text-foreground/60"}`}
                      >
                        {t("auth.passwordRuleLength")}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {compositionValid ? (
                        <RemixIcon
                          name="checkbox_circle"
                          size="size-4"
                          filled
                          className="text-success"
                        />
                      ) : (
                        <RemixIcon
                          name="checkbox_blank"
                          size="size-4"
                          className="text-foreground/40"
                        />
                      )}
                      <span
                        className={`${compositionValid ? "text-foreground" : "text-foreground/60"}`}
                      >
                        {t("auth.passwordRuleComposition")}
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              <PasswordField
                id="confirmPassword"
                label={t("auth.confirmPasswordLabel")}
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  if (matchError) setMatchError(null);
                }}
                autoComplete="new-password"
              />

              {matchError && (
                <p
                  className="text-xs font-medium text-destructive"
                  role="alert"
                >
                  {matchError}
                </p>
              )}

              <Button
                type="submit"
                variant="default"
                className="h-11 w-full"
                disabled={isSubmitting || isSuccessful || !allValid}
              >
                {isSubmitting || isSuccessful ? (
                  <span className="absolute right-4 animate-spin">
                    <RemixIcon name="loader_2" size="size-5" />
                  </span>
                ) : null}
                {isSubmitting || isSuccessful
                  ? t("auth.resetSubmitting")
                  : t("auth.resetSubmitCta")}
              </Button>

              <p className="text-center text-sm text-foreground/60">
                <Link
                  href="/"
                  className="font-semibold text-primary hover:underline"
                >
                  {t("auth.resetBackToLogin")}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="relative hidden lg:flex lg:w-1/2">
        <Image
          src="/images/login.png"
          alt="Alloomi app interface preview"
          fill
          sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
          priority
        />
      </div>
    </div>
  );
}
