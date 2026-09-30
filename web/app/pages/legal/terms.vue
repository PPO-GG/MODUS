<template>
  <LegalDocument
    eyebrow="Legal"
    icon="i-lucide-file-text"
    title="Terms of Service"
    updated="July 6, 2026"
    :related="{
      to: '/legal/privacy',
      label: 'Privacy Policy',
      icon: 'i-lucide-shield-check',
    }"
  >
    <section>
      <h2>
        1. Acceptance of Terms
      </h2>
      <p>
        By accessing or using the MODUS (Modular Discord Utility System)
        dashboard and its associated Discord bot ("the Service"), you agree
        to be bound by these Terms of Service. If you do not agree to these
        terms, you should not use the Service.
      </p>
    </section>

    <section>
      <h2>
        2. Description of Service
      </h2>
      <p>
        MODUS is a modular Discord bot management platform that allows
        server administrators to configure and manage bot modules, commands,
        and server settings through a web dashboard. The Service includes:
      </p>
      <ul>
        <li>
          Web-based dashboard for bot configuration
        </li>
        <li>
          Discord bot functionality across configured servers
        </li>
        <li>
          Module management (music, recording, moderation, milestones, etc.)
        </li>
        <li>
          Server monitoring and status reporting
        </li>
      </ul>
    </section>

    <section>
      <h2>
        3. User Accounts
      </h2>
      <p>
        To use the Service, you must authenticate using your Discord account
        via Discord OAuth2. By signing in, you authorize us to access basic
        information from your Discord profile, including your username,
        avatar, and server memberships. You are responsible for all activity
        that occurs under your account.
      </p>
    </section>

    <section>
      <h2>
        4. Acceptable Use
      </h2>
      <p>
        You agree not to use the Service to:
      </p>
      <ul>
        <li>
          Violate any applicable laws or regulations
        </li>
        <li>
          Violate Discord's
          <a
            href="https://discord.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            >Terms of Service</a
          >
          or
          <a
            href="https://discord.com/guidelines"
            target="_blank"
            rel="noopener noreferrer"
            >Community Guidelines</a
          >
        </li>
        <li>
          Attempt to gain unauthorized access to the Service or its
          underlying systems
        </li>
        <li>
          Interfere with or disrupt the integrity or performance of the
          Service
        </li>
        <li>
          Use the Service for spam, harassment, or abuse of any kind
        </li>
        <li>
          Reverse-engineer, decompile, or attempt to extract the source code
          of the Service (except where permitted by law)
        </li>
      </ul>
    </section>

    <section>
      <h2>
        5. Bot Permissions
      </h2>
      <p>
        When adding the MODUS bot to a Discord server, you grant it the
        permissions required for its enabled modules to function. These may
        include reading and sending messages, managing voice channels, and
        accessing server member information. You can revoke these
        permissions at any time by removing the bot from your server.
      </p>
    </section>

    <section>
      <h2>
        6. Content and Recordings
      </h2>
      <p>
        Certain modules (such as the Recording module) may capture audio
        from Discord voice channels. By enabling these modules, you
        acknowledge that:
      </p>
      <ul>
        <li>
          You are responsible for informing all participants in a voice
          channel that recording is taking place
        </li>
        <li>
          You comply with all applicable consent and privacy laws regarding
          audio recording in your jurisdiction
        </li>
        <li>
          Recordings are accessible only to the server owner and
          administrators with access to server settings
        </li>
        <li>
          MODUS is not responsible for how you use recorded content
        </li>
      </ul>
    </section>

    <section>
      <h2>
        7. AI Module Usage
      </h2>
      <p>
        The AI Assistant module uses third-party AI providers (including
        Groq, OpenAI, Anthropic, and Google) to process user messages. By
        using
        this module, you acknowledge that:
      </p>
      <ul>
        <li>
          MODUS reads the last 5 messages in the channel for context when
          the AI module is invoked — no message content is stored by MODUS
        </li>
        <li>
          Messages are sent to third-party AI providers for processing and
          are subject to those providers' respective privacy policies
        </li>
        <li>
          AI-generated responses are provided as-is and may not always be
          accurate, complete, or appropriate
        </li>
        <li>
          You are responsible for the content of prompts you submit and for
          how you use AI-generated responses
        </li>
      </ul>
    </section>

    <section>
      <h2>
        8. Service Availability
      </h2>
      <p>
        We strive to keep the Service operational, but we do not guarantee
        100% uptime. The Service may be temporarily unavailable due to
        maintenance, updates, or circumstances beyond our control. We are
        not liable for any loss or damage arising from Service
        interruptions.
      </p>
    </section>

    <section>
      <h2>
        9. Limitation of Liability
      </h2>
      <p>
        The Service is provided "as is" and "as available" without
        warranties of any kind. To the fullest extent permitted by law, we
        disclaim all warranties, express or implied. We shall not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages resulting from your use of the Service.
      </p>
    </section>

    <section>
      <h2>
        10. Termination
      </h2>
      <p>
        We reserve the right to suspend or terminate your access to the
        Service at any time, with or without cause. You may stop using the
        Service at any time by removing the bot from your servers and
        ceasing to access the dashboard.
      </p>
    </section>

    <section>
      <h2>
        11. Changes to These Terms
      </h2>
      <p>
        We may update these Terms from time to time. Continued use of the
        Service after changes constitutes your acceptance of the revised
        Terms. We encourage you to review these Terms periodically.
      </p>
    </section>

    <section>
      <h2>
        12. Contact
      </h2>
      <p>
        If you have any questions about these Terms of Service, please
        contact us at
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
  title: "Terms of Service",
  meta: [
    {
      name: "description",
      content:
        "Terms of Service for the MODUS Modular Discord Utility System dashboard and bot.",
    },
  ],
});
defineOgImage("Modus", { eyebrow: "Legal", title: "Terms of Service" });
</script>
