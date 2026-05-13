"use client";

export function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-8 w-8" : "h-6 w-6";
  const initial = (name ?? "?").charAt(0).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ""}
        className={`${sizeClass} shrink-0 rounded-full border border-border bg-muted object-cover`}
        title={name ?? ""}
      />
    );
  }
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-xs font-semibold text-primary`}
      title={name ?? ""}
    >
      {initial}
    </div>
  );
}
