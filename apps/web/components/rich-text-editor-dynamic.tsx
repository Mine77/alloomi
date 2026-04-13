import dynamic from "next/dynamic";

export const RichTextEditor = dynamic(
  () =>
    import("./rich-text-editor").then((mod) => ({
      default: mod.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse min-h-[120px] bg-muted rounded-xl" />
    ),
  },
);
