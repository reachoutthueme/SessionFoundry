"use client";

export default function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(600px 380px at 50% 55%, rgba(155,107,255,.10), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-20 animate-gradient-drift"
        style={{
          background:
            "linear-gradient(120deg, rgba(155,107,255,.25), rgba(90,168,255,.18), rgba(99,62,214,.22))",
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}

