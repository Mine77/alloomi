"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { useSession } from "next-auth/react";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { isTauri, openUrl } from "@/lib/tauri";
import { storeAuthToken } from "@/lib/auth/token-manager";

import { register, type RegisterActionState } from "../actions";
import { getHomePath } from "@/lib/utils";

export default function Page() {
  const router = useRouter();
  const { data: session } = useSession();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPasswordTips, setShowPasswordTips] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const hasHandledSuccess = useRef(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: "idle",
    },
  );
  const { t } = useTranslation();

  const lengthValid = passwordValue.length >= 8 && passwordValue.length <= 20;
  const compositionValid =
    /[A-Za-z]/.test(passwordValue) && /\d/.test(passwordValue);

  const validatePassword = (value: string) => {
    return (
      value.length >= 8 &&
      value.length <= 20 &&
      /[A-Za-z]/.test(value) &&
      /\d/.test(value)
    );
  };

  useEffect(() => {
    if (state.status === "success" && !hasHandledSuccess.current) {
      // Token is set by server via Set-Cookie, also stored on client
      if (state.token) {
        storeAuthToken(state.token);
      }

      toast({ type: "success", description: t("auth.toastRegisterSuccess") });
      setIsSuccessful(true);
      hasHandledSuccess.current = true;
      router.push(getHomePath());
    } else if (state.status === "user_exists" && !hasHandledSuccess.current) {
      toast({ type: "error", description: t("auth.toastRegisterExists") });
    } else if (state.status === "failed" && !hasHandledSuccess.current) {
      // Show specific error message returned by server
      let errorMessage: string;
      if (state.error?.startsWith("auth.")) {
        errorMessage = t(state.error);
      } else {
        errorMessage = state.error || t("auth.toastRegisterFailed");
      }
      toast({ type: "error", description: errorMessage });
    } else if (state.status === "invalid_data" && !hasHandledSuccess.current) {
      toast({
        type: "error",
        description: t("auth.toastInvalidData"),
      });
    }
  }, [state.status, t]);

  useEffect(() => {
    // Only redirect to home page when user is logged in and not a guest user
    // Note: check session.user.type instead of email prefix
    if (session?.user && session.user.type !== "guest") {
      const searchParams = new URLSearchParams(window.location.search);
      const isGoogleSignUp =
        searchParams.get("from") === "google" && !searchParams.get("error");

      if (isGoogleSignUp && !hasHandledSuccess.current) {
        hasHandledSuccess.current = true;
      }
      router.push(getHomePath());
    }
  }, [session, router]);

  const handleSubmit = (formData: FormData) => {
    hasHandledSuccess.current = false;
    setEmail(formData.get("email") as string);

    const password = (formData.get("password") as string) ?? "";

    if (!validatePassword(password)) {
      setPasswordError(t("auth.passwordInvalid"));
      return;
    }
    setPasswordError(null);

    if (!acceptedTerms) {
      setTermsError(t("auth.termsRequired"));
      return;
    }
    setTermsError(null);

    formAction(formData);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-3 text-center sm:text-left">
            <h1 className="font-serif text-[32px] font-semibold text-foreground text-center">
              {t("auth.signUpTitle")}
            </h1>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <AuthForm
              action={handleSubmit}
              defaultEmail={email}
              emailLabel={t("auth.emailLabel")}
              emailPlaceholder={t("auth.emailPlaceholder")}
              passwordLabel={t("auth.passwordLabel")}
              passwordPlaceholder={t("auth.passwordPlaceholder")}
              passwordAutoComplete="new-password"
              passwordFooter={
                showPasswordTips && (
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
                )
              }
              passwordError={passwordError}
              onPasswordFocus={() => setShowPasswordTips(true)}
              onPasswordBlur={() => setShowPasswordTips(false)}
              onPasswordChange={(value) => {
                setPasswordValue(value);
                if (passwordError) {
                  setPasswordError(null);
                }
              }}
            >
              <div className="space-y-4">
                <label className="flex items-start gap-3 text-sm text-foreground/70">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={acceptedTerms}
                    onChange={(event) => {
                      setAcceptedTerms(event.target.checked);
                      if (event.target.checked) {
                        setTermsError(null);
                      }
                    }}
                    className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>
                    {t("auth.agreeTo")}{" "}
                    {isTauri() ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            openUrl("https://app.alloomi.ai/terms")
                          }
                          className="font-semibold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                        >
                          {t("common.terms")}
                        </button>
                        {", "}
                        <button
                          type="button"
                          onClick={() =>
                            openUrl("https://app.alloomi.ai/privacy")
                          }
                          className="font-semibold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                        >
                          {t("common.customerPrivacyPolicy")}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/terms"
                          className="font-semibold text-primary hover:underline"
                        >
                          {t("common.terms")}
                        </Link>
                        {", "}
                        <Link
                          href="/privacy"
                          className="font-semibold text-primary hover:underline"
                        >
                          {t("common.customerPrivacyPolicy")}
                        </Link>
                      </>
                    )}
                  </span>
                </label>
                {termsError ? (
                  <p
                    className="text-xs font-medium text-destructive"
                    role="alert"
                  >
                    {termsError}
                  </p>
                ) : null}

                <SubmitButton
                  className="h-11 w-full"
                  isSuccessful={isSuccessful}
                >
                  {t("auth.signUpCta")}
                </SubmitButton>
              </div>

              <p className="text-center text-sm text-foreground/60">
                {t("auth.haveAccount")}
                <Link
                  href="/"
                  className="ml-1 font-semibold text-primary hover:underline"
                >
                  {t("auth.signInLink")}
                </Link>
              </p>
            </AuthForm>
          </div>
        </div>
      </div>

      <div className="relative hidden lg:flex lg:w-1/2">
        <Image
          src="/images/login.png"
          alt="Alloomi communication assistant illustration"
          fill
          sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
          priority
        />
      </div>
    </div>
  );
}
