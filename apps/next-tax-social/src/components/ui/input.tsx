import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const isNumberInput = type === "number";
  const [isFocused, setIsFocused] = React.useState(false);
  const [displayValue, setDisplayValue] = React.useState(() => (props.value ?? props.defaultValue ?? "").toString());
  const suppressNextMouseUp = React.useRef(false);

  React.useEffect(() => {
    if (!isNumberInput || isFocused) return;
    setDisplayValue((props.value ?? props.defaultValue ?? "").toString());
  }, [isFocused, isNumberInput, props.defaultValue, props.value]);

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
    props.onFocus?.(event);
    setIsFocused(true);
    if (isNumberInput) {
      suppressNextMouseUp.current = true;
      requestAnimationFrame(() => event.currentTarget.select());
    }
  };

  const handleMouseUp: React.MouseEventHandler<HTMLInputElement> = (event) => {
    props.onMouseUp?.(event);
    if (isNumberInput && suppressNextMouseUp.current) {
      event.preventDefault();
      suppressNextMouseUp.current = false;
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    if (isNumberInput) {
      setDisplayValue(event.target.value);
    }
    props.onChange?.(event);
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (event) => {
    props.onBlur?.(event);
    setIsFocused(false);
    if (isNumberInput && event.target.value === "") {
      setDisplayValue((props.value ?? 0).toString());
    }
  };

  const controlledNumberProps = isNumberInput
    ? {
        value: displayValue,
        inputMode: "decimal" as const,
      }
    : {};

  return (
    <input
      {...props}
      type={isNumberInput ? "text" : type}
      onFocus={handleFocus}
      onMouseUp={handleMouseUp}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        isNumberInput && "numeric-input",
        className,
      )}
      {...controlledNumberProps}
    />
  );
}
