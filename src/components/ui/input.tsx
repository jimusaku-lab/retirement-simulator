import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
    props.onFocus?.(event);
    if (type === "number") {
      requestAnimationFrame(() => event.currentTarget.select());
    }
  };

  return (
    <input
      type={type}
      onFocus={handleFocus}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        type === "number" && "numeric-input",
        className,
      )}
      {...props}
    />
  );
}
