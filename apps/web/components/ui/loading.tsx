import { RemixIcon } from "@/components/remix-icon";

interface LoadingProps {
  size?: number;
  color?: string;
  label?: string;
}

const sizeToClass: Record<number, string> = {
  16: "size-4",
  20: "size-5",
  24: "size-6",
  32: "size-8",
};

const Loading = ({
  size = 24,
  color = "currentColor",
  label = "Loading...",
}: LoadingProps) => {
  const sizeClass = sizeToClass[size] ?? "size-6";
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
      <span
        className="animate-spin"
        style={color !== "currentColor" ? { color } : undefined}
      >
        <RemixIcon name="loader_2" size={sizeClass} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
};

export default Loading;
