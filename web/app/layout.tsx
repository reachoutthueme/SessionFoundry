// app/layout.tsx (cleaned, single definition)
import "./globals.css";
import type { ReactNode } from "react";
import ClientProviders from "@/components/ClientProviders";
import Shell from "@/components/Shell";

export const metadata = {
  title: "SessionFoundry",
  description: "Turn workshops into decisions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          <Shell>{children}</Shell>
        </ClientProviders>
      </body>
    </html>
  );
}
