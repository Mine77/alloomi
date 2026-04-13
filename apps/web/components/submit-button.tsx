"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { Button, type ButtonProps } from "./ui/button";

type SubmitButtonProps = {
  children: React.ReactNode;
  isSuccessful: boolean;
  className?: string;
} & Pick<ButtonProps, "variant" | "size">;

export function SubmitButton({
  children,
  isSuccessful,
  className,
  variant,
  size,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type={pending ? "button" : "submit"}
      aria-disabled={pending || isSuccessful}
      disabled={pending || isSuccessful}
      variant={variant}
      size={size}
      className={cn("relative", className)}
    >
      {children}

      {(pending || isSuccessful) && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "Loading" : "Submit form"}
      </output>
    </Button>
  );
}
