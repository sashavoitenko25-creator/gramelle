"use client";

import { useId } from "react";

/** GRAM mark — rounded coin with clean G */
export function GramIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gid = `gramGrad_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="16" cy="16" r="15" fill={`url(#${gid})`} />
      <circle
        cx="16"
        cy="16"
        r="12.5"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <path
        d="M20.2 11.2C19.2 10.1 17.7 9.4 16 9.4c-3.7 0-6.6 2.9-6.6 6.6s2.9 6.6 6.6 6.6c1.7 0 3.2-.7 4.3-1.8"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 16.2h5.6"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={gid} x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#5EEAD4" />
          <stop offset="0.45" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
