<template>
  <LegalDocument
    eyebrow="Privacy"
    icon="i-lucide-shield-check"
    title="Privacy Policy"
    updated="July 6, 2026"
    :related="{
      to: '/legal/terms',
      label: 'Terms of Service',
      icon: 'i-lucide-file-text',
    }"
  >
    <!-- Intro -->
    <section>
      <p>
        Your privacy matters to us. This Privacy Policy explains what
        information we collect, how we use it, and your rights regarding
        that data when you use MODUS (Modular Discord Utility System) and
        its web dashboard.
      </p>
    </section>

    <section>
      <h2>
        1. Information We Collect
      </h2>
      <p>
        We collect the minimum amount of information necessary to provide
        the Service. When you sign in via Discord OAuth2, we receive:
      </p>
      <ul>
        <li>
          <strong>Discord User ID</strong> — Your
          unique Discord identifier
        </li>
        <li>
          <strong>Username & Avatar</strong> — For
          display within the dashboard
        </li>
        <li>
          <strong>Server Memberships</strong> — To
          determine which servers you can manage
        </li>
        <li>
          <strong>Email Address</strong> — If
          provided by Discord as part of OAuth, used solely for account
          identification
        </li>
      </ul>
      <p>
        Additionally, the bot may process the following in the context of
        enabled modules:
      </p>
      <ul>
        <li>
          <strong>Message Metadata</strong> —
          Character counts for milestone tracking (message content is not
          stored)
        </li>
        <li>
          <strong>Voice Channel Audio</strong> — Only
          when the Recording module is explicitly enabled and active.
          Recordings are accessible only to the server owner and
          administrators with access to server settings
        </li>
        <li>
          <strong>Server Configuration Data</strong>
          — Module settings, enabled features, and preferences you configure
        </li>
        <li>
          <strong>Music Queue Data</strong> — Song
          titles, URLs, and queue preferences for the Music module
        </li>
        <li>
          <strong>AI Conversations</strong> — When
          the AI Assistant module is used, MODUS reads the last 5 messages
          in the channel for context. These messages are sent to third-party
          AI providers (Groq, OpenAI, Anthropic, Google) for processing.
          <strong class="legal-em">No conversation data is stored by MODUS.</strong
          >
        </li>
      </ul>
    </section>

    <section>
      <h2>
        2. How We Use Your Information
      </h2>
      <p>
        Your information is used exclusively to:
      </p>
      <ul>
        <li>
          Authenticate you and provide access to the dashboard
        </li>
        <li>
          Display your servers and their configuration status
        </li>
        <li>
          Persist your module settings and preferences
        </li>
        <li>
          Operate the bot's features as you've configured them
        </li>
        <li>
          Monitor system health and troubleshoot issues (via server logs)
        </li>
      </ul>
    </section>

    <section class="legal-callout">
      <h2>
        <UIcon name="i-lucide-shield-alert" class="legal-callout-icon" />
        3. We Do Not Sell Your Data
      </h2>
      <p>
        <strong class="legal-em">
          We will never sell, rent, trade, or otherwise provide your
          personal information to third parties for marketing or commercial
          purposes.
        </strong>
        Your data is used solely to operate the Service. Period.
      </p>
    </section>

    <section>
      <h2>
        4. Data Sharing
      </h2>
      <p>
        We only share your information in the following limited cases:
      </p>
      <ul>
        <li>
          <strong>With Discord</strong> — As required
          for the bot to function within Discord's platform via their API
        </li>
        <li>
          <strong>Infrastructure Providers</strong> —
          Configuration and account data is stored in our self-hosted
          database. Voice recordings and welcome images are stored with
          Cloudflare (R2 object storage) solely for Service operation
        </li>
        <li>
          <strong>Legal Requirements</strong> — If
          required to comply with a legal obligation, court order, or
          governmental request
        </li>
      </ul>
    </section>

    <section>
      <h2>
        5. Data Retention
      </h2>
      <p>
        We retain your data only as long as necessary to provide the
        Service:
      </p>
      <ul>
        <li>
          <strong>Account Data</strong> — Retained
          while you actively use the Service. If you remove the bot and
          discontinue usage, your data may be deleted upon request.
        </li>
        <li>
          <strong>Server Configurations</strong> —
          Retained while the bot is present in your server. Configurations
          may be removed when the bot leaves.
        </li>
        <li>
          <strong>Recordings</strong> — Audio
          recordings are stored only for the duration you specify and are
          accessible only to authorized server members.
        </li>
        <li>
          <strong>Logs</strong> — Server and
          operational logs are retained for a limited period for
          troubleshooting and are not used for profiling.
        </li>
      </ul>
    </section>

    <section>
      <h2>
        6. Data Security
      </h2>
      <p>
        We implement reasonable security measures to protect your data,
        including:
      </p>
      <ul>
        <li>
          Encrypted authentication via Discord OAuth2 (we never see or store
          your Discord password)
        </li>
        <li>
          Secure, authenticated API communications
        </li>
        <li>
          Restricted access to database and infrastructure
        </li>
      </ul>
      <p>
        While we take security seriously, no system is completely immune to
        risk. We cannot guarantee absolute security of your data.
      </p>
    </section>

    <section>
      <h2>
        7. Your Rights
      </h2>
      <p>You have the right to:</p>
      <ul>
        <li>
          <strong>Access</strong> — Request a copy of
          the data we hold about you
        </li>
        <li>
          <strong>Deletion</strong> — Request that we
          delete your data by removing the bot from your servers and
          contacting us
        </li>
        <li>
          <strong>Withdraw Consent</strong> — Revoke
          Discord OAuth access at any time via your Discord
          <a
            href="https://discord.com/settings/authorized-apps"
            target="_blank"
            rel="noopener noreferrer"
            >Authorized Apps settings</a
          >
        </li>
        <li>
          <strong>Opt Out of Modules</strong> —
          Disable any module at any time to stop the associated data
          processing
        </li>
      </ul>
    </section>

    <section>
      <h2>
        8. Children's Privacy
      </h2>
      <p>
        The Service is not intended for users under the age of 13 (or the
        minimum age required by Discord in your jurisdiction). We do not
        knowingly collect data from children. If you believe a child has
        provided data to us, please contact us for removal.
      </p>
    </section>

    <section>
      <h2>
        9. Third-Party Services
      </h2>
      <p>
        The Service interacts with third-party platforms (primarily
        Discord). Their privacy policies govern the data they collect. We
        encourage you to review:
      </p>
      <ul>
        <li>
          <a
            href="https://discord.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            >Discord Privacy Policy</a
          >
        </li>
        <li>
          <a
            href="https://openai.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            >OpenAI Privacy Policy</a
          >
        </li>
        <li>
          <a
            href="https://www.anthropic.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            >Anthropic Privacy Policy</a
          >
        </li>
        <li>
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            >Google Privacy Policy</a
          > (Gemini)
        </li>
        <li>
          <a
            href="https://groq.com/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            >Groq Privacy Policy</a
          >
        </li>
        <li>
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
            >Cloudflare Privacy Policy</a
          > (R2 object storage)
        </li>
      </ul>
    </section>

    <section>
      <h2>
        10. Changes to This Policy
      </h2>
      <p>
        We may update this Privacy Policy from time to time. Any changes
        will be reflected on this page with an updated "Last updated" date.
        Continued use of the Service after changes constitutes acceptance of
        the revised policy.
      </p>
    </section>

    <section>
      <h2>
        11. Contact
      </h2>
      <p>
        If you have questions about this Privacy Policy or wish to exercise
        your data rights, please contact us at
        <a
          href="mailto:support@ppo.gg"
          >support@ppo.gg</a
        >.
      </p>
    </section>
  
  </LegalDocument>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "landing",
});

useHead({
  title: "Privacy Policy",
  meta: [
    {
      name: "description",
      content:
        "Privacy Policy for the MODUS Modular Discord Utility System. Learn how we handle your data — we never sell it.",
    },
  ],
});
defineOgImage("Modus", { eyebrow: "Legal", title: "Privacy Policy" });
</script>
