"use client";
import { useState } from "react";
import { RemixIcon } from "@/components/remix-icon";

import { cn } from "@/lib/utils";

import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";

type AuthFormProps = {
  action: string | ((formData: FormData) => void | Promise<void>);
  children: React.ReactNode;
  defaultEmail?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  emailAutoComplete?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  passwordAutoComplete?: string;
  passwordFooter?: React.ReactNode;
  passwordError?: string | null;
  onPasswordFocus?: () => void;
  onPasswordBlur?: () => void;
  onPasswordChange?: (value: string) => void;
};

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  emailLabel = "Email Address",
  emailPlaceholder = "user@acme.com",
  emailAutoComplete = "email",
  passwordLabel = "Password",
  passwordPlaceholder,
  passwordAutoComplete = "current-password",
  passwordFooter,
  passwordError,
  onPasswordFocus,
  onPasswordBlur,
  onPasswordChange,
}: AuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="text-sm font-medium text-foreground/80 dark:text-zinc-200"
        >
          {emailLabel}
        </Label>

        <Input
          id="email"
          name="email"
          className="bg-background text-base"
          type="email"
          placeholder={emailPlaceholder}
          autoComplete={emailAutoComplete}
          required
          defaultValue={defaultEmail}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="text-sm font-medium text-foreground/80 dark:text-zinc-200"
        >
          {passwordLabel}
        </Label>

        <div className="relative">
          <Input
            id="password"
            name="password"
            className={cn(
              "bg-background text-base pr-10",
              passwordError
                ? "border-destructive focus-visible:ring-destructive"
                : undefined,
            )}
            type={showPassword ? "text" : "password"}
            placeholder={passwordPlaceholder}
            autoComplete={passwordAutoComplete}
            required
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "password-error" : undefined}
            onFocus={onPasswordFocus}
            onBlur={onPasswordBlur}
            onChange={(event) => onPasswordChange?.(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={togglePasswordVisibility}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <RemixIcon name="eye_off" size="size-4" />
            ) : (
              <RemixIcon name="eye" size="size-4" />
            )}
          </Button>
        </div>

        {passwordFooter}

        {passwordError ? (
          <p
            id="password-error"
            role="alert"
            className="text-xs font-medium text-destructive"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      {children}
    </form>
  );
}
