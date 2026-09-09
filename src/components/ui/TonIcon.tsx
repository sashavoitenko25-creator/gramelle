"use client";

/**
 * Circular TON logo — transparent outside the circle.
 * Matches official TON mark style.
 */
export function TonIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        d="M28 14.5L40.5 21.8V34.2L28 41.5L15.5 34.2V21.8L28 14.5Z"
        fill="white"
      />
      <path
        d="M28 19.2V36.8L37.2 31.3V24.7L28 19.2Z"
        fill="#0098EA"
        fillOpacity="0.35"
      />
      <path
        d="M28 19.2L18.8 24.7V31.3L28 36.8V19.2Z"
        fill="#0098EA"
        fillOpacity="0.55"
      />
      <path
        d="M22.2 22.4h11.6v3.2H30.2v10.2h-4.4V25.6h-3.6v-3.2z"
        fill="white"
      />
    </svg>
  );
}
