"use client";

import { useId } from "react";

/** Telegram Stars style mark */
export function StarsIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gid = `starsGrad_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 2.5l2.4 5.3 5.7.6-4.3 3.9 1.3 5.6L12 15.5 6.9 17.9l1.3-5.6-4.3-3.9 5.7-.6L12 2.5z"
        fill={`url(#${gid})`}
        stroke="#F5C542"
        strokeWidth="0.6"
      />
      <defs>
        <linearGradient id={gid} x1="4" y1="2" x2="20" y2="20">
          <stop stopColor="#FFE566" />
          <stop offset="1" stopColor="#F5A623" />
        </linearGradient>
      </defs>
    </svg>
  );
}
