import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type ChangeEvent,
} from "react";
import { cn } from "@/lib/utils"; // Assume you have a utility function handling classNames

// Define radio group context type
type RadioGroupContextType = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled: boolean;
};

// Create radio group context
const RadioGroupContext = createContext<RadioGroupContextType | undefined>(
  undefined,
);

// Radio group component props
interface RadioGroupProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Radio group container component
 * Manages selection state for a group of radio buttons
 */
export const RadioGroup = ({
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  className,
}: RadioGroupProps) => {
  const [valueState, setValueState] = useState(defaultValue);
  const value = valueProp ?? valueState;

  const handleValueChange = (newValue: string) => {
    if (valueProp === undefined) {
      setValueState(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <RadioGroupContext.Provider
      value={{ value, onValueChange: handleValueChange, disabled }}
    >
      <div className={cn("flex flex-col gap-2", className)} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
};

// Radio item component props
interface RadioGroupItemProps {
  value: string;
  id: string;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Option component within a radio group
 * Used as a child component of RadioGroup
 */
export const RadioGroupItem = ({
  value,
  id,
  children,
  disabled: disabledProp,
  className,
}: RadioGroupItemProps) => {
  const context = useContext(RadioGroupContext);

  if (!context) {
    throw new Error("RadioGroupItem must be used within a RadioGroup");
  }

  const { value: groupValue, onValueChange, disabled: groupDisabled } = context;
  const disabled = disabledProp || groupDisabled;
  const isChecked = groupValue === value;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onValueChange(e.target.value);
    }
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <input
        type="radio"
        value={value}
        id={id}
        checked={isChecked}
        onChange={handleChange}
        disabled={disabled}
        className="h-4 w-4 rounded-full border-border text-primary focus:ring-ring disabled:opacity-50"
      />
      {children && (
        <label
          htmlFor={id}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            disabled ? "text-gray-500" : "text-gray-900",
          )}
        >
          {children}
        </label>
      )}
    </div>
  );
};
