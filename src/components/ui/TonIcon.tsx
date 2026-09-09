"use client";

/** Official TON mark — circular, transparent outside the circle */
export function TonIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ton-logo.png"
      width={size}
      height={size}
      alt=""
      className={className}
      draggable={false}
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block" }}
      aria-hidden
    />
  );
}
