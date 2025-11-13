// no local nav in header; policies are shown standalone or in modals

export const metadata = {
  title: "Privacy Policy - SessionFoundry",
  description: "How SessionFoundry handles and protects your data.",
};

import BackgroundDecor from "@/components/ui/BackgroundDecor";

export default function PrivacyPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <BackgroundDecor />
      <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Privacy Policy</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Our commitment to your privacy, in clear and simple terms.
            </p>
          </div>
        </div>
      </header>

      <article className="prose-sm leading-6 text-[var(--muted)]">
        <section className="space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">1. Who we are</h2>
          <p>
            SessionFoundry ("we", "us", "our") is a web app for planning and
            running workshops, collecting input from participants, voting on
            ideas, and exporting results.
          </p>
          <p>
            <strong>Data controller:</strong> SessionFoundry
            <br />
            <strong>Contact:</strong> reachoutthueme@gmail.com
          </p>
          <p>
            Under the EU General Data Protection Regulation (GDPR), the "data
            controller" is the party that decides why and how personal data is
            processed. We act as controller for facilitator accounts and
            participant data in sessions you run.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">2. What data we collect</h2>
          <p>We collect only what we need to run the service.</p>

          <h3 className="font-medium">2.1 Facilitator account data</h3>
          <p>When you create an account or sign in as a facilitator, we collect:</p>
          <ul className="list-disc pl-6">
            <li>Email address</li>
            <li>
              Password (stored as a secure hash through our authentication
              provider, not in plain text)
            </li>
            <li>Plan / subscription status (for example, "free", "pro")</li>
            <li>Basic app activity like which sessions you created</li>
          </ul>
          <p>
            <em>Why we need it:</em> to let you sign in, manage workshops,
            access exports, and enforce plan limits.
          </p>

          <h3 className="font-medium">2.2 Workshop/session data</h3>
          <p>When you create a session we store:</p>
          <ul className="list-disc pl-6">
            <li>Session name, description and metadata</li>
            <li>
              Activities you configure (for example, brainstorm prompts,
              stocktake prompts, timing, voting rules)
            </li>
            <li>Internal tags/labels you add</li>
            <li>Whether voting is enabled, budget, max submissions, etc.</li>
          </ul>
          <p>
            <em>Why we need it:</em> to run your workshop and show you results.
          </p>

          <h3 className="font-medium">2.3 Participant data</h3>
          <p>When someone joins a session as a participant we collect:</p>
          <ul className="list-disc pl-6">
            <li>
              Display name they enter (real name, nickname, or group name - up
              to what they type)
            </li>
            <li>Which group/team they joined</li>
            <li>Their submissions (ideas, comments, suggestions)</li>
            <li>Their votes in voting activities</li>
          </ul>
          <p>
            <em>Why we need it:</em>
          </p>
          <ul className="list-disc pl-6">
            <li>
              to show input live to the facilitator and (in some cases) to other
              participants
            </li>
            <li>to calculate scores, consensus and results</li>
            <li>to let the facilitator export a summary after the workshop</li>
          </ul>
          <p>
            Note: participant display name plus their submission can be personal
            data under GDPR if it can be linked back to an identifiable person
            (GDPR Article 4(1)). We treat it as personal data.
          </p>

          <h3 className="font-medium">2.4 Usage and technical data</h3>
          <p>When you use the app, we (or our hosting providers) may receive:</p>
          <ul className="list-disc pl-6">
            <li>IP address</li>
            <li>Browser/device info</li>
            <li>Timestamps, basic request logs, error logs</li>
          </ul>
          <p>
            <em>Why we need it:</em>
          </p>
          <ul className="list-disc pl-6">
            <li>to keep the service reliable and secure</li>
            <li>to debug performance issues</li>
            <li>to prevent abuse/fraud</li>
          </ul>
          <p>We currently do not run advertising trackers or behavioral ad pixels.</p>

          <h3 className="font-medium">2.5 Cookies / local storage</h3>
          <p>We use:</p>
          <ul className="list-disc pl-6">
            <li>
              An authentication/session cookie so that when you refresh the page
              you remain signed in
            </li>
            <li>
              Local storage flags (for example, remembering if you collapsed the
              sidebar, and in some flows a "logged_out" marker so we do not
              auto-log you back in when you have explicitly chosen to sign out)
            </li>
          </ul>
          <p>We do not use third-party advertising cookies.</p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">
            3. Why we process your data (legal bases)
          </h2>
          <p>Under GDPR we must tell you the legal basis for processing.</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Contract necessity (GDPR 6(1)(b)).</strong> Creating and
              maintaining your facilitator account; letting you run workshops.
            </li>
            <li>
              <strong>Legitimate interests (GDPR 6(1)(f)).</strong> Preventing
              spam and abuse, debugging crashes, enforcing rate limits, keeping
              audit trails to investigate misuse.
            </li>
            <li>
              <strong>Legal obligations (GDPR 6(1)(c)).</strong> Retaining
              minimal records if required to respond to lawful requests, fraud
              investigations, or data subject rights requests.
            </li>
          </ol>
          <p>
            We do not perform automated decision-making with legal or similar
            significant effects, and we do not do marketing profiling.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">
            4. How we use (and share) data
          </h2>
          <p>We use your data to:</p>
          <ul className="list-disc pl-6">
            <li>authenticate you</li>
            <li>show you your sessions and activities</li>
            <li>let participants submit ideas and votes in real time</li>
            <li>calculate and display results, leaderboards, consensus, averages</li>
            <li>generate exports (for example, a summary/report/deck)</li>
          </ul>
          <p>We share data with:</p>
          <ul className="list-disc pl-6">
            <li>
              Hosting providers: Vercel (app hosting/deployment) and Supabase
              (database, auth, storage). Personal data you enter is stored and
              processed on those providers' infrastructure.
            </li>
            <li>
              Other participants in the same session (depending on settings),
              who may see each other's submissions, votes, names, or scores.
            </li>
          </ul>
          <p>We do not sell personal data to advertisers.</p>
          <p>
            <strong>International transfers:</strong> Providers may process data
            in the EU or outside the EEA. If personal data is transferred to a
            country outside the EEA, GDPR requires appropriate safeguards (for
            example, standard contractual clauses) to protect that data (GDPR
            Article 46).
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">
            5. How long we keep data
          </h2>
          <ul className="list-disc pl-6">
            <li>Facilitator account data: as long as your account is active</li>
            <li>
              Session content (activities, submissions, votes): so you can
              revisit and export outcomes
            </li>
            <li>
              Basic access logs and diagnostic logs: for security and abuse
              prevention
            </li>
          </ul>
          <p>
            We may delete or anonymize workshop data after a period of
            inactivity, or if you ask us to delete it (see "Your rights"). If we
            are legally required to keep certain minimal records (for example, to
            show when a request was made, or to enforce a "do not contact"
            rule), we may keep that limited record even after deleting the main
            content. Under GDPR, the right to erasure is not absolute.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">
            6. Your rights under GDPR
          </h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Right of access (Art. 15).</strong> Get a copy of your
              personal data and details about processing. We respond without
              undue delay and generally within one month.
            </li>
            <li>
              <strong>Right to rectification (Art. 16).</strong> Ask us to
              correct inaccurate personal data.
            </li>
            <li>
              <strong>Right to erasure (Art. 17).</strong> Ask us to delete your
              personal data when it is no longer needed, consent is withdrawn,
              or you object and there is no overriding reason.
            </li>
            <li>
              <strong>Right to restriction (Art. 18).</strong> Ask us to pause
              certain processing, for example while verifying accuracy.
            </li>
            <li>
              <strong>Right to data portability (Art. 20).</strong> Receive the
              data you provided in a structured, commonly used, machine-readable
              format.
            </li>
            <li>
              <strong>Right to object (Art. 21).</strong> Object to certain
              processing, especially where we rely on legitimate interests.
            </li>
            <li>
              <strong>Right to complain.</strong> Lodge a complaint with your
              local data protection authority (in Denmark: Datatilsynet).
            </li>
          </ol>
          <p>
            To exercise your rights, email
            {' '}<a className="underline" href="mailto:reachoutthueme@gmail.com">reachoutthueme@gmail.com</a>
            {' '}and describe which right you are exercising. We may ask you to
            verify your identity.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">7. Children's data</h2>
          <p>
            SessionFoundry is not designed for children under 16 to create
            facilitator accounts. Facilitators are responsible for how they
            invite participants and for obtaining appropriate consent where
            required.
          </p>
          <p>
            If you believe we collected personal data from a child without
            proper basis, contact us and we will review and, if appropriate,
            delete it.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">8. Security</h2>
          <p>We take reasonable technical and organizational measures to protect data, including:</p>
          <ul className="list-disc pl-6">
            <li>Authentication through Supabase (passwords are hashed)</li>
            <li>Role separation between "facilitator" and "participant"</li>
            <li>Access controls limiting who can view certain session data</li>
            <li>HTTPS/TLS in transit</li>
            <li>Logged access to backend actions to help detect abuse</li>
          </ul>
          <p>No online system is 100% secure, but we work to reduce risk.</p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">
            9. Data retention for exported reports
          </h2>
          <p>
            One of SessionFoundry's core features is generating a summary/deck
            of all submissions, votes, and insights after a workshop. That
            export can contain personal data (like participant display names and
            what they said). Once you download an export, you - as the
            facilitator - are responsible for storing/using/sharing it in a
            GDPR-compliant way within your organization.
          </p>
          <p>
            If a participant asks for their data to be removed, we can delete it
            from our live systems (subject to legal exceptions), but we cannot
            automatically pull it back from files you have already exported and
            stored elsewhere.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">
            10. Changes to this policy
          </h2>
          <p>
            We may update this Privacy Policy as we add features (for example:
            payments, organization workspaces, analytics dashboards). If we make
            material changes, we will update the "Last updated" date at the top
            and, where appropriate, notify account holders via email or in-app
            notice.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-base font-medium text-[var(--text)]">11. Contact</h2>
          <p>
            To ask questions or exercise your GDPR rights, contact us at
            {' '}<a className="underline" href="mailto:reachoutthueme@gmail.com">reachoutthueme@gmail.com</a>.
            If you are unsatisfied with our response, you can contact your local
            data protection authority. In Denmark, that is Datatilsynet (the
            Danish Data Protection Agency).
          </p>
        </section>
      </article>
      </div>
    </div>
  );
}

