import "../../app/globals.css";
import ClientProviders from "../../components/ClientProviders";
import type { ReactNode } from "react";

export default function MinimalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          <main className="min-h-dvh bg-[var(--bg)]">
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}

