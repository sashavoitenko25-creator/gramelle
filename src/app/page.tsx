"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.href = "/index.html";
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
      Loading...
    </div>
  );
}