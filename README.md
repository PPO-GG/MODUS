<p align="center">
  <img src="https://modusbot.io/modus2-animated.svg" alt="MODUS" width="280" />
</p>

<h3 align="center">One bot. Every module. Fully open source.</h3>

<p align="center">
  A verified, modular Discord bot with a real-time web dashboard. Moderation, tickets, music, voice recording, leveling, giveaways, an AI assistant and more, each toggled per server.
</p>

<p align="center">
  <a href="https://modus.ppo.gg">Website &amp; Dashboard</a> ·
  <a href="INSTALLATION.md">Self-Hosting Guide</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## What is MODUS?

MODUS replaces the pile of single-purpose bots most servers end up with. Instead of running separate bots for moderation, music, tickets, welcome messages and logging, MODUS handles all of it through independent modules you turn on or off per server.

Everything is configured from a web dashboard (Nuxt 4) instead of slash commands. The bot and dashboard share a Postgres backend, with Redis for cross-shard coordination and Cloudflare R2 for recordings and welcome backgrounds.

## Features

### Moderation & Safety

- **Moderation** — warn, kick, ban, timeout, purge, slowmode and lock/unlock, with case history, automatic escalation (e.g. 3 warnings triggers a timeout), DM notifications and a modlog channel.
- **AutoMod** — rule-based filtering with regex/contains/starts-with/role conditions, AND/OR logic, per-rule cooldowns, exemptions and actions (delete, warn, timeout, kick, ban, DM, log). Describe a rule in plain English on the dashboard and let the AI draft it for you.
- **Anti-Raid** — join-rate detection (X joins in Y seconds) with automatic lockdown.
- **Verification** — button-based gate with role assignment.
- **Logging** — per-category audit log: message edits/deletes, joins/leaves, role and channel changes, invite tracking.

### Support & Community

- **Tickets** — deployable panels, tickets as threads, claim/add/remove users, priority buttons, auto-generated transcripts on close and idle-ticket sweeps.
- **Reaction Roles** — button and dropdown panels, no emoji reactions needed.
- **Temporary Voice Channels** — join a lobby to spawn a personal channel with naming templates and user limits; it auto-deletes when empty.
- **Triggers** — custom auto-responses and webhook receivers (GitHub, Twitch or custom) that post formatted embeds.
- **Tags** — reusable text/embed snippets with autocomplete.
- **Events** — scheduled server events with timezone support.

### Engagement

- **XP & Leveling** — rank cards, a real-time leaderboard on the dashboard, and a character-count milestone tracker.
- **Giveaways** — timed giveaways with entry requirements, reroll and winner announcements.
- **Polls** — native Discord polls with visual result bars.
- **Reminders** — `/remindme`, also available through the AI assistant.

### Creative & Media

- **Welcome Banners** — canvas-rendered images built in a visual dashboard editor: text, images, shapes and avatars with fonts, shadows, opacity, rotation and borders.
- **Embed / Message Builder** — rich embeds and V2 components from the dashboard or via slash command.
- **Music** — Lavalink v4 playback with queue management, loop/shuffle/autoplay, lyrics, volume, audio filters (Bass Boost, Nightcore, Vaporwave, 8D, Karaoke, Tremolo, Vibrato and more) and durable queues that survive restarts.
- **Voice Recording** — per-user multitrack recording with silence-padded timing so tracks stay aligned. Higher bitrates and longer limits are available with Discord Premium subscriptions.
- **Alerts** — Twitch go-live (EventSub), YouTube uploads, GitHub activity and any RSS feed.

### AI Assistant (optional)

Chat with an LLM directly in Discord, or just ask for things in natural language. The assistant can use tools to:

- search the web and images
- play, pause, skip, shuffle and queue music
- create, update and delete reminders
- check the weather

Servers can set their own provider/API key, system prompt, token limits and per-user cooldowns. Supports Anthropic, OpenAI, Google Gemini and Groq.

## Web Dashboard

A separate Nuxt 4 service that uses the same Postgres backend as the bot, with Discord OAuth login via `nuxt-auth-utils`. Server admins can configure every module, design welcome banners, manage recordings, review logs and monitor bot health. Access can be scoped per module with dashboard RBAC. Public pages are server-rendered, and `/dashboard/**` runs as a SPA.

## Stack

| Layer | Tech |
|-------|------|
| Bot | Discord.js 14, Lavalink 4 (Shoukaku), Node 22, TypeScript |
| Web | Nuxt 4, nuxt-auth-utils, @nuxt/ui, Tailwind CSS, Pinia |
| Data | Postgres (Drizzle), Redis, Cloudflare R2 |
| AI | Anthropic, OpenAI, Google Gemini, Groq |
| Infra | Docker Compose, GHCR, pnpm workspaces |

## Self-Hosting

MODUS is MIT-licensed and fully self-hostable. See the [Installation Guide](INSTALLATION.md) for Docker (prebuilt images or from source) and native development setup.

## Project Structure

```
bot/                    Discord bot
  modules/              Feature plugins (auto-loaded)
  lib/                  Shared utilities
  ModuleManager.ts      Plugin loader and interaction router
  DatabaseService.ts    Data facade (repositories + cache + storage)

web/                    Nuxt 4 dashboard
  app/pages/            File-based routing
  app/composables/      Vue composition hooks
  server/api/           Backend API routes

packages/db/            @modus/db: shared schema, drizzle client, repositories
```

Modules are self-contained. Drop a file in `bot/modules/` and it gets picked up automatically, with no registration step.

## License

MIT — see [LICENSE](LICENSE).
