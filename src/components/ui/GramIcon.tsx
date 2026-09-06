"use client";

/** Official GRAM badge */
export function GramIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/gram-badge.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      draggable={false}
    />
  );
}
