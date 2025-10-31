import Link from "next/link";

export const metadata = {
  title: "Policies - SessionFoundry",
  description: "Privacy policy and terms & conditions for SessionFoundry.",
};

export default function PoliciesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Policies</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Legal and policy documents for SessionFoundry.
        </p>
      </header>

      <div className="space-y-3 text-sm text-[var(--muted)]">
        <div>
          <Link className="underline" href="/privacy">
            Privacy Policy
          </Link>
          <div className="text-xs">How we handle and protect your data.</div>
        </div>

        <div>
          <Link className="underline" href="/terms">
            Terms & Conditions
          </Link>
          <div className="text-xs">The rules for using SessionFoundry.</div>
        </div>
      </div>
    </div>
  );
}

