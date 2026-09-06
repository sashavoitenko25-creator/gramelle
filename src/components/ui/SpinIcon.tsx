/** Clear roulette / SPIN mark — colored segments + pointer */
export function SpinIcon({
  className = "w-5 h-5",
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* outer ring */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      {/* pie segments */}
      <path d="M12 12 L12 3 A9 9 0 0 1 19.5 7.5 Z" fill="currentColor" opacity="0.85" />
      <path d="M12 12 L19.5 7.5 A9 9 0 0 1 19.5 16.5 Z" fill="currentColor" opacity="0.35" />
      <path d="M12 12 L19.5 16.5 A9 9 0 0 1 12 21 Z" fill="currentColor" opacity="0.7" />
      <path d="M12 12 L12 21 A9 9 0 0 1 4.5 16.5 Z" fill="currentColor" opacity="0.3" />
      <path d="M12 12 L4.5 16.5 A9 9 0 0 1 4.5 7.5 Z" fill="currentColor" opacity="0.65" />
      <path d="M12 12 L4.5 7.5 A9 9 0 0 1 12 3 Z" fill="currentColor" opacity="0.25" />
      {/* hub */}
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="black" opacity="0.35" />
      {/* top pointer */}
      <path d="M12 1.2 L13.4 4.2 H10.6 Z" fill="currentColor" />
    </svg>
  );
}
