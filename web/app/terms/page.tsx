// no local nav in header; policies are shown standalone or in modals

export const metadata = {
  title: "Terms & Conditions - SessionFoundry",
  description: "Terms and conditions for using SessionFoundry.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Terms & Conditions</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              The rules and conditions for using SessionFoundry.
            </p>
          </div>
        </div>
      </header>

      <article className="prose-sm leading-6 text-[var(--muted)]">
        <section className="space-y-2">
          <div className="text-xs text-[var(--muted)]">Last updated: 26 October 2025</div>
          <p>
            These Terms are a legal agreement between you (the facilitator or
            customer) and SessionFoundry ("we", "us"). By creating an account or
            using the Service, you agree to these Terms. If you do not agree,
            do not use the Service. You must be at least 16 years old to create
            a facilitator account.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">1. What SessionFoundry is</h2>
          <p>
            SessionFoundry is a web-based tool for planning and facilitating
            workshops. Facilitators can create sessions and activities, invite
            participants, collect input and votes, view results, and export
            summaries. Participants can join a session (often without creating
            an account), submit input, and vote if enabled. We may update,
            improve, or change features over time.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">2. Accounts and access</h2>
          <h3 className="font-medium">2.1 Facilitator accounts</h3>
          <p>
            You create an account with an email and password. You are
            responsible for keeping your login details confidential and for any
            actions under your account.
          </p>
          <h3 className="font-medium">2.2 Participant access</h3>
          <p>
            Participants can join sessions using a session code or link you
            share. You are responsible for sharing join details only with people
            who should be in that session.
          </p>
          <h3 className="font-medium">2.3 Your responsibility</h3>
          <ul className="list-disc pl-6">
            <li>Do not share admin access insecurely.</li>
            <li>Do not attempt to access sessions you do not own.</li>
            <li>Do not interfere with or disrupt the Service.</li>
            <li>Do not reverse engineer, probe, or bypass security or rate limits.</li>
          </ul>
          <p>
            We may suspend or disable accounts that violate these Terms, abuse
            the platform, or pose a security/privacy risk to others.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">3. Your content and data</h2>
          <h3 className="font-medium">3.1 Your content</h3>
          <p>
            "Content" means anything input into the Service by you or your
            participants: prompts, submissions, votes, names, group labels,
            comments, rankings, etc. You are responsible for having rights to
            the content and for not uploading illegal or confidential material.
          </p>
          <h3 className="font-medium">3.2 Sensitive / high‑risk content</h3>
          <p>
            The Service is not designed for health data, government IDs,
            financial numbers, or special‑category personal data under GDPR
            (e.g., race, religion, sexual orientation, political opinions),
            except where you have a lawful basis and all required consents. If
            you enter such data, you confirm you have the right to do so and
            accept responsibility.
          </p>
          <h3 className="font-medium">3.3 Facilitator responsibility</h3>
          <p>
            If you invite participants (employees, clients, etc.), you are the
            party introducing their data into the Service and must comply with
            applicable laws when collecting and sharing their input.
          </p>
          <h3 className="font-medium">3.4 License to operate the Service</h3>
          <p>
            You grant us a limited, worldwide, non‑exclusive license to store,
            process, analyze, display, and generate derived summaries from your
            content solely to operate the Service. We do not sell your content
            to advertisers or publish your workshops publicly.
          </p>
          <h3 className="font-medium">3.5 Exports and downloads</h3>
          <p>
            Exports may contain personal data. Once exported, files are under
            your control. You are responsible for storing/sharing them in
            compliance with your policies and applicable law (e.g., GDPR).
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">4. Privacy and data protection</h2>
          <p>
            See our <a className="underline" href="/privacy">Privacy Policy</a>
            {' '}for details on what personal data we collect, how we use it,
            legal bases, retention, and your rights.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">5. Acceptable use</h2>
          <ul className="list-disc pl-6">
            <li>No illegal, infringing, or harmful content.</li>
            <li>No harassment, abuse, discrimination, or doxxing.</li>
            <li>No attempts to overload, scrape, or impair the Service.</li>
            <li>No attempts to gain unauthorized access to other users’ data.</li>
          </ul>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">6. Plans, billing, refunds</h2>
          <p>
            Free plan: limited usage. Pro plan: extended features (e.g.,
            exports). Fees are prepaid for the period shown. Except where
            required by law, fees are non‑refundable once the period starts.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">7. Intellectual property</h2>
          <p>
            We retain all rights in and to the Service, software, and branding.
            These Terms do not grant you ownership of the Service. You retain
            ownership of your content, subject to the operational license above.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">8. Service changes and availability</h2>
          <p>
            We may change or discontinue features. We aim for high availability
            but do not guarantee uninterrupted Service.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">9. Disclaimers</h2>
          <p>
            The Service is provided “as is” without warranties of any kind,
            express or implied (including merchantability, fitness for a
            particular purpose, and non‑infringement).
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">10. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we are not liable for
            indirect, incidental, special, consequential, or punitive damages,
            or any loss of profits, revenues, data, or goodwill. Our aggregate
            liability is limited to the fees you paid to use the Service in the
            12 months before the claim.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">11. Indemnity</h2>
          <p>
            You agree to indemnify and hold us harmless from claims arising out
            of your use of the Service, your content, or your violation of
            these Terms or applicable law.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">12. Termination</h2>
          <p>
            You may stop using the Service at any time. We may suspend or
            terminate access if you violate these Terms or if required by law.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">13. Governing law</h2>
          <p>
            These Terms are governed by the laws of Denmark, without regard to
            conflict of laws. Courts of Denmark shall have jurisdiction, unless
            mandatory consumer protection laws apply otherwise.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">14. Changes to these Terms</h2>
          <p>
            We may update these Terms as we add features. If we make material
            changes, we will update the “Last updated” date and, where
            appropriate, notify account holders via email or in‑app notice.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-white">15. Contact</h2>
          <p>
            Questions about these Terms: reach us at
            {' '}<a className="underline" href="mailto:reachoutthueme@gmail.com">reachoutthueme@gmail.com</a>.
          </p>
        </section>
      </article>
    </div>
  );
}
