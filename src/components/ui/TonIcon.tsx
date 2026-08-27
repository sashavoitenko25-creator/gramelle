"use client";

import { useId } from "react";

/** TON diamond mark — unique gradient id per instance */
export function TonIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gid = `tonGrad_${uid}`;

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
      <path
        d="M28 8L48 20.5V35.5L28 48L8 35.5V20.5L28 8Z"
        fill={`url(#${gid})`}
      />
      <path
        d="M28 12.2L43.6 22V34L28 43.8L12.4 34V22L28 12.2Z"
        fill="#0098EA"
      />
      <path
        d="M28.2 20.5v15.8l11.4-6.9V27.4L28.2 20.5z"
        fill="white"
        fillOpacity="0.92"
      />
      <path
        d="M28.2 20.5L16.8 27.4v2l11.4 6.9V20.5z"
        fill="white"
        fillOpacity="0.5"
      />
      <defs>
        <linearGradient id={gid} x1="8" y1="8" x2="48" y2="48">
          <stop stopColor="#6DD3FF" />
          <stop offset="1" stopColor="#0098EA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
