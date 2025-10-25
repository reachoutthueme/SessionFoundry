"use client";
import Image from "next/image";

export default function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const w = size, h = size;
  return (
    <div style={{ width: w, height: h }} className={`relative ${className}`}>
      {/* Light theme: purple mark */}
      <Image
        src="/foundry-mark.png"
        alt="SessionFoundry"
        width={w}
        height={h}
        priority
        className="absolute inset-0 logo-light"
      />
      {/* Dark theme: white mark */}
      <Image
        src="/foundry-mark-white.png"
        alt="SessionFoundry"
        width={w}
        height={h}
        priority
        className="absolute inset-0 logo-dark"
      />
    </div>
  );
}
