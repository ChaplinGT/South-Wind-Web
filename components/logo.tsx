import { brand } from "@/lib/brand";

const sources = {
  horizontal: brand.horizontal,
  stacked: brand.stacked,
  wordmark: brand.wordmark,
  mark: brand.mark,
  horizontalOnLight: brand.horizontalOnLight,
  markOnLight: brand.markOnLight,
} as const;

export function Logo({
  variant = "horizontal",
  className = "",
}: {
  variant?: keyof typeof sources;
  className?: string;
}) {
  return (
    <img
      src={sources[variant]}
      alt="South Wind Global Services LLC"
      className={className}
    />
  );
}
