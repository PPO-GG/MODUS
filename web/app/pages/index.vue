<template>
  <NuxtLayout name="landing">
    <div ref="root">
      <!-- ========== HERO ========== -->
      <section class="glide-section hero">
        <div class="bounded">
          <div class="hero-inner">
            <svg
              class="hero-grid"
              viewBox="0 0 935 425"
              fill="none"
              aria-hidden="true"
            >
              <template v-for="r in GRID_ROWS" :key="r">
                <path
                  v-for="c in GRID_COLS"
                  :key="c"
                  class="grid-item"
                  fill="currentColor"
                  opacity=".2"
                  :d="`M${(c - 1) * 32 + 5},${(r - 1) * 32 + 10}l1.806,-2.951l-5,2.951l3.936,1.049l-0.742,-1.049z`"
                />
              </template>
            </svg>

            <div v-if="stats" class="hero-status">
              <span
                class="hero-status-dot"
                :class="stats.online ? 'is-online' : 'is-offline'"
              ></span>
              {{ stats.online ? "Online" : "Offline" }}
              <template v-if="stats.online">
                · v{{ stats.version }} · {{ stats.shardCount }}/{{
                  stats.totalShards
                }}
                shards
              </template>
            </div>

            <h1 class="hero-heading">
              Your Discord server,
              <em class="glide-text">supercharged</em>
            </h1>
            <p class="hero-body">
              One modular bot for music, moderation, AI, anti-raid and
              multi-track recordings. Configure all of it from a web dashboard.
            </p>
            <div class="hero-ctas">
              <a
                :href="botInviteUrl"
                target="_blank"
                rel="noopener"
                class="glide-btn"
              >
                <UIcon name="i-simple-icons-discord" class="w-5 h-5" />
                Add MODUS to your server
              </a>
              <NuxtLink to="/dashboard" class="glide-btn glide-btn-ghost">
                Open dashboard
                <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
              </NuxtLink>
            </div>

            <!-- Dashboard preview -->
            <div class="hero-shot glide-glass">
              <div class="hero-glow hero-glow--one"></div>
              <div class="hero-glow hero-glow--two"></div>
              <img
                class="hero-shot-img"
                src="/screenshots/herodash.webp"
                width="1920"
                height="985"
                fetchpriority="high"
                decoding="async"
                alt="The MODUS dashboard's server Overview page: setup items that need attention, open tickets, recent moderation, a community snapshot and bot-flagged issues"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ========== STATS ========== -->
      <section id="stats" class="stats" aria-label="Live bot stats">
        <div class="bounded">
          <div class="stats-row">
            <div class="stat">
              <b>{{ stats?.serverCount?.toLocaleString() ?? "—" }}</b>
              <small>Servers</small>
            </div>
            <div class="stat">
              <b>{{ moduleList.length }}</b><small>Modules</small>
            </div>
            <div class="stat">
              <b>{{ stats?.shardCount ?? 0 }}/{{ stats?.totalShards ?? 0 }}</b>
              <small>Shards online</small>
            </div>
            <div class="stat">
              <b>v{{ stats?.version ?? "—" }}</b><small>Version</small>
            </div>
          </div>
        </div>
      </section>

      <!-- ========== BENTO ========== -->
      <section id="features" class="glide-section">
        <div class="bounded">
          <h2 class="glide-h2">
            Everything your server <em class="glide-text">needs</em>
          </h2>
          <p class="glide-lede">
            Replace a stack of single-purpose bots with one. Each module is
            independent, so you only turn on what you use.
          </p>

          <div class="bento">
            <article class="bento-box glide-glass is-wide">
              <h3>Music that sounds right</h3>
              <p>
                Lavalink-backed playback with queues, filters and per-guild
                volume. Search YouTube or paste a link.
              </p>
              <div class="bento-art bento-art--col">
                <div class="wave" aria-hidden="true">
                  <i
                    v-for="(h, i) in waveBars"
                    :key="i"
                    class="wave-bar"
                    :style="{ height: `${h}px`, opacity: i > waveBars.length * 0.38 ? 0.3 : 0.85 }"
                  ></i>
                </div>
                <div class="now-playing">
                  <UIcon name="i-lucide-play" class="w-4 h-4 text-teal-400" />
                  <span><b>Midnight City</b> · M83</span>
                  <span class="now-playing-bar"></span>
                  <span class="mono">1:34 / 4:03</span>
                </div>
              </div>
            </article>

            <article class="bento-box glide-glass">
              <h3>AI assistant</h3>
              <p>GPT and Claude, with tools that set reminders and start polls.</p>
              <div class="bento-art">
                <div class="chat">
                  <div class="chat-msg is-user">
                    remind the mods about the raid drill friday 8pm
                  </div>
                  <div class="chat-msg is-bot">
                    Done. I'll ping <b>@Mods</b> on Fri at 8:00 PM.
                  </div>
                </div>
              </div>
            </article>

            <article class="bento-box glide-glass">
              <h3>Moderation</h3>
              <p>Kick, ban, warn and timeout with a full audit trail.</p>
              <div class="bento-art">
                <div class="modlog">
                  <div><span class="t">21:04</span><span class="k">BAN</span>spam_acc</div>
                  <div><span class="t">21:06</span><span class="w">WARN</span>nova · caps</div>
                  <div><span class="t">21:09</span><span class="w">TIMEOUT</span>kai · 10m</div>
                  <div><span class="t">21:12</span><span class="ok">AUTOMOD</span>link blocked</div>
                </div>
              </div>
            </article>

            <article class="bento-box glide-glass">
              <h3>Anti-raid</h3>
              <p>Spots join floods and locks the server before raiders post.</p>
              <div class="bento-art">
                <svg
                  class="raid-chart"
                  viewBox="0 0 240 110"
                  role="img"
                  aria-label="Join rate spiking above the lockdown threshold"
                >
                  <line x1="0" y1="40" x2="240" y2="40" stroke="#fb7185" stroke-dasharray="4 4" />
                  <text x="236" y="34" text-anchor="end" fill="#fda4af" font-size="10" font-family="DM Mono, monospace">lockdown · 15/min</text>
                  <path
                    d="M0 96 L30 92 L60 94 L90 90 L110 86 L130 30 L150 12 L170 58 L190 92 L240 95"
                    fill="none"
                    stroke="#2dd4bf"
                    stroke-width="2"
                  />
                  <circle cx="150" cy="12" r="4" fill="#fb7185" />
                </svg>
              </div>
            </article>

            <article class="bento-box glide-glass">
              <h3>XP &amp; rank cards</h3>
              <p>Leveling, role rewards and rank cards you design yourself.</p>
              <div class="bento-art">
                <div class="rank">
                  <span class="rank-avatar"></span>
                  <div class="rank-meta">
                    <div><b>nova</b><small>LVL 24 · #3</small></div>
                    <div class="rank-xp"><i></i></div>
                    <small>7,210 / 10,000 XP</small>
                  </div>
                </div>
              </div>
            </article>

            <article class="bento-box glide-glass">
              <h3>Recordings</h3>
              <p>One audio track per speaker. Download a zip or mix in the browser.</p>
              <div class="bento-art">
                <div class="tracks">
                  <div v-for="t in tracks" :key="t.name" class="track">
                    <span>{{ t.name }}</span>
                    <div class="track-lane">
                      <i
                        v-for="(seg, i) in t.segments"
                        :key="i"
                        :style="{ left: `${seg[0]}%`, width: `${seg[1]}%`, background: t.color }"
                      ></i>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- ========== ONE BOT (Glide "Integrations") ========== -->
      <section class="glide-section integr">
        <div class="integr-bg"></div>
        <svg
          v-for="(frame, i) in logoFrames"
          :key="i"
          class="integr-frame"
          :style="{ transform: frame }"
          viewBox="0 0 767 604"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M282.5 519.7 603.7 604 489.9 445.6l52.3-84.2H381.3ZM406 321.8h160.8L767 0 515.8 145.9ZM442.6 188.5l-83.2 133.3H213Zm-107.9 172.9-92.3 147.8L0 445.6l144.9-84.2Z"
            fill="rgba(240,241,244,.04)"
            stroke="rgba(255,255,255,.12)"
            stroke-width="2"
          />
        </svg>
        <div class="bounded">
          <h2 class="glide-h2 integr-heading">One bot, every job</h2>
          <p class="glide-lede">
            Music, moderation, AI, alerts and tickets share one config, one
            permission model and one dashboard.
          </p>
          <div
            class="chain"
            role="img"
            aria-label="MODUS connects music, moderation, AI, social alerts, tickets and recordings"
          >
            <template v-for="(node, i) in chainNodes" :key="node.icon">
              <template v-if="i === chainMid">
                <div class="chain-core glide-glass">
                  <img src="/modus2-animated.svg" alt="" />
                </div>
                <div class="chain-signal is-rev"></div>
              </template>
              <div class="chain-node">
                <UIcon :name="node.icon" class="chain-node-icon" />
              </div>
              <div
                v-if="i !== chainNodes.length - 1"
                class="chain-signal"
                :class="{ 'is-rev': i >= chainMid }"
              ></div>
            </template>
          </div>
          <div class="chain-caption">
            <span v-for="node in chainNodes" :key="node.label">{{ node.label }}</span>
          </div>
        </div>
      </section>

      <!-- ========== SHOWCASE ========== -->
      <section id="dashboard" class="glide-section">
        <div class="bounded">
          <div class="showcase-glow"></div>
          <h2 class="glide-h2">
            Configure it all <em class="glide-text">in the browser</em>
          </h2>

          <div class="showcase">
            <div class="showcase-grid"></div>
            <div class="showcase-copy">
              <figure>
                <UIcon name="i-lucide-shield-ban" class="w-7 h-7" />
              </figure>
              <h3>AutoMod rules, no regex required</h3>
              <p>
                Pick a trigger, add the conditions that must match, and chain
                the actions to take. Group conditions with AND / OR when one
                rule needs more logic.
              </p>
              <ul>
                <li><UIcon name="i-lucide-check" class="w-4 h-4 mt-1 shrink-0 text-teal-400" />Delete, warn, timeout or log on match</li>
                <li><UIcon name="i-lucide-check" class="w-4 h-4 mt-1 shrink-0 text-teal-400" />Nested condition groups and per-action delays</li>
                <li><UIcon name="i-lucide-check" class="w-4 h-4 mt-1 shrink-0 text-teal-400" />Changes apply on every shard instantly</li>
              </ul>
              <NuxtLink to="/dashboard" class="glide-btn">Open dashboard</NuxtLink>
            </div>
            <div class="showcase-image is-narrow">
              <img
                src="/screenshots/automod.webp"
                width="899"
                height="1105"
                loading="lazy"
                decoding="async"
                alt="The AutoMod rule editor with a Message Created trigger, a message-content condition, and a Send Channel Message action"
              />
            </div>
          </div>

          <div class="showcase is-reversed">
            <div class="showcase-grid"></div>
            <div class="showcase-copy">
              <figure>
                <UIcon name="i-lucide-party-popper" class="w-7 h-7" />
              </figure>
              <h3>Welcome cards, drawn your way</h3>
              <p>
                Drag avatars, text and backgrounds on a canvas. MODUS renders
                the image for every new member.
              </p>
              <NuxtLink to="/dashboard" class="glide-btn">Try the editor</NuxtLink>
            </div>
            <div class="showcase-image">
              <img
                src="/screenshots/welcome_editor.webp"
                width="1920"
                height="1038"
                loading="lazy"
                decoding="async"
                alt="The welcome card editor: layer list and shape tools on the left, a welcome card with an avatar and greeting text on the canvas, and position and border controls on the right"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ========== MODULES ========== -->
      <section id="modules" class="glide-section pt-0!">
        <div class="bounded">
          <h2 class="glide-h2">
            {{ moduleList.length }} modules, <em class="glide-text">one bot</em>
          </h2>
          <p class="glide-lede">Enable what you need and leave the rest off.</p>
          <ul class="module-chips">
            <li v-for="mod in moduleList" :key="mod.name" class="module-chip" :title="mod.tagline">
              <UIcon :name="mod.icon" class="w-4 h-4" />
              {{ mod.name }}
            </li>
          </ul>
        </div>
      </section>

      <!-- ========== CTA ========== -->
      <section class="glide-section cta">
        <div class="bounded">
          <div class="cta-glow"></div>
          <div class="cta-icon glide-glass">
            <img src="/modus2-animated.svg" alt="MODUS" />
          </div>
          <h2>Ready to level up your server?</h2>
          <div class="hero-ctas cta-buttons">
            <a :href="botInviteUrl" target="_blank" rel="noopener" class="glide-btn">
              <UIcon name="i-simple-icons-discord" class="w-5 h-5" />
              Add MODUS to Discord
            </a>
            <NuxtLink to="/docs" class="glide-btn">Read the docs</NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import gsap from "gsap";

definePageMeta({
  layout: false,
});

const config = useRuntimeConfig();

const botInviteUrl = computed(() => {
  const clientId = config.public.discordClientId as string;
  if (!clientId) return "#";
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=8`;
});

// Fetch live stats
interface BotStats {
  online: boolean;
  serverCount: number;
  shardCount: number;
  totalShards: number;
  version: string;
}
const { data: stats } = await useFetch<BotStats>("/api/stats");

const LANDING_DESCRIPTION =
  "MODUS is a free all-in-one Discord bot: music, moderation, anti-raid, AI, multi-track voice recordings, XP leaderboards and tickets — configured from a web dashboard.";
useSeoMeta({
  // Wrapped by app.vue's titleTemplate → "… | MODUS".
  title: "Free All-in-One Discord Bot with Web Dashboard",
  description: LANDING_DESCRIPTION,
  ogTitle: "MODUS — Your Discord Server, Supercharged",
  ogDescription: LANDING_DESCRIPTION,
});
defineOgImage("Modus", {
  title: "Your Discord Server, Supercharged",
  description:
    "Music, moderation, anti-raid, AI, voice recordings, XP leaderboards and tickets — all from one web dashboard.",
});

// schema.org SoftwareApplication so search engines can show MODUS as an app
// (price, category) rather than a generic web page.
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "MODUS",
        alternateName: "Modular Discord Utility System",
        applicationCategory: "CommunicationApplication",
        operatingSystem: "Discord",
        description: LANDING_DESCRIPTION,
        url: useSiteConfig().url,
        image: `${useSiteConfig().url}/modus2.svg`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }),
    },
  ],
});

const moduleList = [
  { name: "Music", icon: "i-lucide-disc-3", tagline: "High-fidelity playback & queue" },
  { name: "Recording", icon: "i-lucide-audio-waveform", tagline: "Per-user voice recording" },
  { name: "AI Assistant", icon: "i-lucide-bot", tagline: "GPT & Claude integration" },
  { name: "Moderation", icon: "i-lucide-gavel", tagline: "Kick, ban, warn, timeout" },
  { name: "AutoMod", icon: "i-lucide-shield-ban", tagline: "Spam, link & word filters" },
  { name: "Logging", icon: "i-lucide-scroll-text", tagline: "Full audit log system" },
  { name: "Anti-Raid", icon: "i-lucide-siren", tagline: "Join flood detection" },
  { name: "Verification", icon: "i-lucide-badge-check", tagline: "Button-based member gate" },
  { name: "Welcome", icon: "i-lucide-party-popper", tagline: "Dynamic welcome images" },
  { name: "XP & Leveling", icon: "i-lucide-trophy", tagline: "XP tracking, rank cards & leaderboards" },
  { name: "Giveaways", icon: "i-lucide-gift", tagline: "Prizes, raffles & entry requirements" },
  { name: "Tickets", icon: "i-lucide-ticket", tagline: "Support ticket system" },
  { name: "Reaction Roles", icon: "i-lucide-smile-plus", tagline: "Self-assign roles via reactions" },
  { name: "Temp Voice", icon: "i-lucide-mic-vocal", tagline: "Auto-create voice rooms" },
  { name: "Webhooks", icon: "i-lucide-webhook", tagline: "Webhooks to custom embeds" },
  { name: "Social Alerts", icon: "i-lucide-bell-ring", tagline: "YouTube & Twitch notifications" },
  { name: "Custom Embeds", icon: "i-lucide-layout-template", tagline: "Visual embed builder" },
  { name: "Tags", icon: "i-lucide-tag", tagline: "Reusable message snippets" },
  { name: "Polls", icon: "i-lucide-bar-chart-3", tagline: "Interactive voting system" },
  { name: "Events", icon: "i-lucide-calendar-clock", tagline: "Scheduled events manager" },
  { name: "Help", icon: "i-lucide-circle-question-mark", tagline: "Auto-generated command help" },
  { name: "Ping", icon: "i-lucide-activity", tagline: "Latency metrics" },
  { name: "Shard Info", icon: "i-lucide-server-cog", tagline: "Shard diagnostics & performance" },
  { name: "Reminders", icon: "i-lucide-clock", tagline: "Natural-language reminders" },
  { name: "Text-to-Speech", icon: "i-lucide-volume-2", tagline: "AI voice speaks in your channel" },
];

// ── Bento illustrations ─────────────────────────────────────────────────
// Deterministic so SSR and hydration agree.
const waveBars = Array.from({ length: 64 }, (_, i) =>
  Math.min(96, 18 + Math.abs(Math.sin(i * 0.37) * 55 + Math.sin(i * 1.3) * 22)),
);
const tracks = [
  { name: "nova", color: "rgba(45,212,191,.55)", segments: [[4, 22], [40, 14], [70, 20]] },
  { name: "kai", color: "rgba(56,189,248,.55)", segments: [[18, 18], [58, 10]] },
  { name: "mynd", color: "rgba(34,211,238,.45)", segments: [[0, 8], [30, 26], [82, 14]] },
];

// ── "One bot" chain ─────────────────────────────────────────────────────
const chainNodes = [
  { label: "Music", icon: "i-lucide-disc-3" },
  { label: "Moderation", icon: "i-lucide-gavel" },
  { label: "AI", icon: "i-lucide-bot" },
  { label: "Social alerts", icon: "i-lucide-bell-ring" },
  { label: "Tickets", icon: "i-lucide-ticket" },
  { label: "Recordings", icon: "i-lucide-audio-waveform" },
];
const chainMid = Math.floor(chainNodes.length / 2);
const logoFrames = [
  "translate(-50%, -50%) scale(1.3)",
  "translate(-120%, -33%) scale(1.3)",
  "translate(20%, -66%) scale(1.3)",
];

// ── Motion (ported from the Glide template's GSAP timelines) ────────────
const GRID_ROWS = 14;
const GRID_COLS = 30;
const root = ref<HTMLElement | null>(null);
let ctx: gsap.Context | undefined;

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  ctx = gsap.context(() => {
    // Hero entrance — transforms only, so content is readable at rest.
    gsap
      .timeline({ defaults: { ease: "power2.inOut" } })
      .from(".hero-heading", { scale: 0.9, duration: 1.2 })
      .from(".hero-body", { y: 14, duration: 1 }, "-=0.7")
      .from(".hero-ctas", { scale: 1.08, duration: 1 }, "-=0.7")
      .from(".hero-shot", { y: 60, duration: 1.2 }, "-=0.5");

    // Arrow-grid ripple from the center, repeating.
    const ripple = {
      stagger: (amount: number) => ({
        amount,
        grid: [GRID_ROWS, GRID_COLS] as [number, number],
        from: "center" as const,
      }),
    };
    gsap.set(".grid-item", { transformOrigin: "center", color: "#fff" });
    gsap.to(".grid-item", {
      repeat: -1,
      repeatDelay: 12,
      keyframes: [
        { opacity: 0.4, rotate: "+=180", color: "#0284c7", scale: 3, duration: 0.6, stagger: ripple.stagger(2) },
        { opacity: 0.2, rotate: "+=180", color: "#fff", scale: 1, delay: -2, duration: 0.6, stagger: ripple.stagger(3) },
      ],
    });

    // Roaming glows behind the dashboard preview.
    const roam = (sel: string, path: [string, string][]) =>
      gsap.to(sel, {
        ease: "power2.inOut",
        repeat: -1,
        keyframes: path.map(([top, left], i) => ({
          top,
          left,
          duration: [0, 2, 3, 2, 3][i],
        })),
      });
    roam(".hero-glow--one", [["0%", "33%"], ["33%", "33%"], ["33%", "0%"], ["0%", "0%"], ["0%", "33%"]]);
    roam(".hero-glow--two", [["33%", "0%"], ["0%", "0%"], ["0%", "33%"], ["33%", "33%"], ["33%", "0%"]]);

    // "One bot" pulse: core flashes, signals travel outward, nodes light up.
    gsap
      .timeline({ repeat: -1, defaults: { ease: "power2.inOut" } })
      .to(".chain-core", {
        keyframes: [
          { filter: "brightness(2)", opacity: 1, duration: 0.4, ease: "power2.in" },
          { filter: "brightness(1)", opacity: 0.8, duration: 0.9 },
        ],
      })
      .to(".chain-signal", {
        keyframes: [
          { backgroundPosition: "0% 0%" },
          { backgroundPosition: "100% 100%", stagger: { from: "center", each: 0.3 }, duration: 1 },
        ],
      }, "-=1.4")
      .to(".chain-node", {
        keyframes: [
          { opacity: 1, duration: 1, stagger: { from: "center", each: 0.3 } },
          { opacity: 0.4, duration: 1, stagger: { from: "center", each: 0.3 } },
        ],
      }, "-=2");

    // Waveform shimmer.
    gsap.to(".wave-bar", {
      scaleY: () => 0.55 + Math.random() * 0.6,
      transformOrigin: "center",
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: { each: 0.03, from: "random" },
    });
  }, root.value ?? undefined);
});

onUnmounted(() => ctx?.revert());
</script>

<style scoped>
/* Layout primitives (Glide "Bounded") */
.glide-section {
  position: relative;
  padding: 3.5rem 1rem;
}
@media (min-width: 768px) {
  .glide-section {
    padding: 5rem 1.5rem;
  }
}
@media (min-width: 1024px) {
  .glide-section {
    padding-block: 6rem;
  }
}
.bounded {
  position: relative;
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.glide-h2 {
  max-width: 48rem;
  margin: 0;
  text-align: center;
  text-wrap: balance;
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  line-height: 1.05;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.glide-lede {
  max-width: 28rem;
  margin: 1.5rem auto 0;
  text-align: center;
  text-wrap: balance;
  color: var(--glide-ink-2);
}
.mono {
  font-family: var(--glide-mono);
}

/* ── Hero ── */
.hero {
  padding-top: 7.5rem;
  text-align: center;
}
@media (min-width: 768px) {
  .hero {
    padding-top: 9rem;
  }
}
.hero-inner {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hero-grid {
  position: absolute;
  top: -3.5rem;
  left: 50%;
  z-index: -1;
  width: min(935px, 120%);
  transform: translateX(-50%);
  color: #fff;
  pointer-events: none;
  mask-image: linear-gradient(black, transparent);
}
.hero-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.75rem;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid var(--glide-line);
  background: rgba(3, 7, 18, 0.6);
  font: 500 0.75rem/1 var(--glide-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--glide-ink-3);
}
.hero-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.hero-status-dot.is-online {
  background: #34d399;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.7);
}
.hero-status-dot.is-offline {
  background: #f87171;
}
.hero-heading {
  max-width: 48rem;
  margin: 0;
  text-wrap: balance;
  font-size: clamp(2.75rem, 7.5vw, 5rem);
  line-height: 1.02;
  font-weight: 500;
  letter-spacing: -0.03em;
}
.hero-body {
  max-width: 30rem;
  margin: 1.5rem auto 0;
  text-wrap: balance;
  color: var(--glide-ink-2);
}
.hero-ctas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem 1.5rem;
  margin-top: 2rem;
}
.hero-shot {
  width: 100%;
  max-width: 64rem;
  margin-top: 4rem;
}
.hero-shot-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
}
.hero-glow {
  position: absolute;
  z-index: -1;
  width: 66%;
  height: 66%;
  mix-blend-mode: screen;
  filter: blur(64px);
  pointer-events: none;
}
@media (min-width: 768px) {
  .hero-glow {
    filter: blur(120px);
  }
}
.hero-glow--one {
  top: 0;
  left: 33%;
  background: var(--glide-glow-1);
}
.hero-glow--two {
  top: 33%;
  left: 0;
  background: var(--glide-glow-2);
}

/* ── Stats ── */
.stats {
  padding: 0.5rem 1rem 1.5rem;
}
.stats-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem 3rem;
  width: 100%;
  padding: 1.375rem 0.5rem;
  border-block: 1px solid rgba(255, 255, 255, 0.08);
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}
.stat b {
  font: 500 1.625rem/1.1 var(--glide-mono);
  font-variant-numeric: tabular-nums;
}
.stat small {
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--glide-ink-4);
}

/* ── Bento ── */
.bento {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  width: 100%;
  max-width: 56rem;
  margin-top: 4rem;
}
@media (min-width: 768px) {
  .bento {
    grid-template-columns: repeat(3, 1fr);
    gap: 2.5rem;
  }
}
.bento-box {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  background: rgba(3, 7, 18, 0.6);
}
.bento-box::before {
  background: rgba(243, 244, 246, 0.08);
}
@media (min-width: 768px) {
  .bento-box.is-wide {
    grid-column: span 2;
  }
}
.bento-box h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.bento-box p {
  max-width: 28rem;
  margin: 0;
  text-wrap: balance;
  color: var(--glide-ink-2);
}
.bento-art {
  display: flex;
  align-items: flex-end;
  align-self: end;
  min-height: 120px;
}
.bento-art--col {
  flex-direction: column;
  align-items: stretch;
}
.wave {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  height: 96px;
}
.wave-bar {
  flex: 1;
  border-radius: 2px;
  background: linear-gradient(to top, var(--glide-a2), var(--glide-a1));
}
.now-playing {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  color: var(--glide-ink-3);
}
.now-playing b {
  font-weight: 500;
  color: var(--glide-ink);
}
.now-playing-bar {
  position: relative;
  flex: 1;
  height: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
}
.now-playing-bar::after {
  content: "";
  position: absolute;
  inset: 0 62% 0 0;
  border-radius: 3px;
  background: var(--glide-a1);
}
.chat {
  display: grid;
  gap: 0.5rem;
  width: 100%;
  font-size: 0.8125rem;
}
.chat-msg {
  max-width: 92%;
  padding: 0.5rem 0.6875rem;
  border-radius: 10px;
  line-height: 1.4;
}
.chat-msg.is-user {
  justify-self: end;
  background: rgba(255, 255, 255, 0.07);
  color: var(--glide-ink-2);
}
.chat-msg.is-bot {
  border: 1px solid rgba(56, 189, 248, 0.25);
  background: rgba(56, 189, 248, 0.14);
}
.modlog {
  width: 100%;
  font: 400 0.75rem/1.8 var(--glide-mono);
  color: var(--glide-ink-3);
}
.modlog div {
  display: flex;
  gap: 0.625rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.modlog .t {
  color: var(--glide-ink-4);
}
.modlog .k {
  color: #fca5a5;
}
.modlog .w {
  color: #fcd34d;
}
.modlog .ok {
  color: #6ee7b7;
}
.raid-chart {
  display: block;
  width: 100%;
  height: 110px;
}
.rank {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
}
.rank-avatar {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f472b6, #fb923c);
}
.rank-meta {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
}
.rank-meta > div:first-child {
  display: flex;
  justify-content: space-between;
}
.rank-meta small {
  font-family: var(--glide-mono);
  color: var(--glide-ink-4);
}
.rank-xp {
  height: 6px;
  margin: 0.5rem 0 0.375rem;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}
.rank-xp i {
  display: block;
  width: 72%;
  height: 100%;
  background: linear-gradient(90deg, var(--glide-a1), var(--glide-a2));
}
.tracks {
  display: grid;
  gap: 0.4375rem;
  width: 100%;
}
.track {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.75rem;
  color: var(--glide-ink-3);
}
.track-lane {
  position: relative;
  height: 20px;
  overflow: hidden;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}
.track-lane i {
  position: absolute;
  top: 3px;
  bottom: 3px;
  border-radius: 3px;
}

/* ── One bot / integrations ── */
.integr {
  overflow: hidden;
}
.integr-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(60% 55% at 50% 58%, rgba(3, 105, 161, 0.55), transparent 70%),
    radial-gradient(35% 40% at 22% 70%, rgba(45, 212, 191, 0.18), transparent 70%),
    radial-gradient(35% 40% at 80% 35%, rgba(56, 189, 248, 0.16), transparent 70%);
}
.integr-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: -1;
  width: 760px;
  max-width: none;
  opacity: 0.5;
  pointer-events: none;
}
.integr-heading {
  padding-block: 0.5rem;
  background: linear-gradient(to bottom, #f0f9ff, #7dd3fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.chain {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 4.5rem;
}
@media (min-width: 768px) {
  .chain {
    flex-direction: row;
  }
}
.chain-node {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  aspect-ratio: 1;
  padding: 1rem;
  border-radius: 50%;
  border: 1px solid rgba(240, 249, 255, 0.3);
  background: rgba(240, 249, 255, 0.14);
  color: #e0f2fe;
  opacity: 0.4;
}
.chain-node-icon {
  width: 1.75rem;
  height: 1.75rem;
}
@media (min-width: 1024px) {
  .chain-node-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
.chain-core {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 8rem;
  height: 8rem;
  margin-block: 0.5rem;
  border-radius: 28px;
  background: linear-gradient(to bottom, #1f2937, #111827);
  opacity: 0.8;
}
.chain-core::before {
  border-radius: 34px;
}
.chain-core img {
  width: 5.5rem;
  height: 5.5rem;
}
@media (min-width: 768px) {
  .chain-core {
    margin: 0 0.75rem;
  }
}
.chain-signal {
  --rotation: 0deg;
  width: 1.5px;
  height: 20px;
  background-color: rgba(255, 255, 255, 0.1);
  background-image: linear-gradient(
    var(--rotation),
    rgba(255, 255, 255, 0) 50%,
    #0ea5e9 50%,
    rgba(255, 255, 255, 0) 70%
  );
  background-size: 500% 500%;
}
@media (min-width: 768px) {
  .chain-signal {
    --rotation: 90deg;
    width: 30px;
    height: 1.5px;
  }
}
@media (min-width: 1024px) {
  .chain-signal {
    width: 44px;
  }
}
@media (min-width: 1280px) {
  .chain-signal {
    width: 54px;
  }
}
.chain-signal.is-rev {
  transform: rotate(180deg);
}
.chain-caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1.25rem;
  margin-top: 1.75rem;
  font: 400 0.75rem/1 var(--glide-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--glide-ink-4);
}

/* ── Showcase ── */
.showcase-glow {
  position: absolute;
  top: 2.5rem;
  z-index: -1;
  width: 100%;
  max-width: 42rem;
  aspect-ratio: 16 / 9;
  border-radius: 50%;
  background: var(--glide-glow-solid);
  mix-blend-mode: screen;
  filter: blur(120px);
  opacity: 0.8;
}
.showcase {
  position: relative;
  isolation: isolate;
  display: grid;
  align-items: center;
  gap: 2rem;
  width: 100%;
  margin-top: 4rem;
  padding: 2rem;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(240, 249, 255, 0.2);
  background: linear-gradient(to bottom, rgba(249, 250, 251, 0.12), rgba(249, 250, 251, 0.04));
  backdrop-filter: blur(4px);
}
@media (min-width: 1024px) {
  .showcase {
    grid-template-columns: 1fr 2fr;
    gap: 3rem;
    padding-block: 3rem;
    overflow: visible;
  }
  /* Image-first panels: the image (order -1) takes the wide column. */
  .showcase:not(.is-reversed) {
    grid-template-columns: 2fr 1fr;
  }
}
.showcase-grid {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  opacity: 0.35;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.18) 1px, transparent 1px);
  background-size: 28px 28px;
  background-position: center;
  mask-image: radial-gradient(circle at 60% 50%, black 10%, transparent 42%);
}
.showcase-copy figure {
  display: grid;
  place-items: center;
  width: fit-content;
  margin: 0;
  padding: 0.875rem;
  border-radius: 8px;
  background: var(--glide-icon-bg);
}
.showcase-copy h3 {
  margin: 1.5rem 0 0;
  font-size: 1.5rem;
  font-weight: 400;
}
.showcase-copy p {
  max-width: 36rem;
  margin: 0.875rem 0 1.375rem;
  color: var(--glide-ink-2);
}
.showcase-copy ul {
  display: grid;
  gap: 0.5rem;
  margin: 0 0 1.375rem;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
  color: var(--glide-ink-2);
}
.showcase-copy li {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}
.showcase-image {
  min-width: 0;
  filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5));
}
.showcase-image img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
/* Near-square captures (e.g. a modal) would dominate the 2fr column. */
.showcase-image.is-narrow img {
  max-width: 28rem;
  margin-inline: auto;
}
@media (min-width: 1024px) {
  .showcase:not(.is-reversed) .showcase-image {
    order: -1;
    transform: translateX(-12%);
  }
  .showcase .showcase-image.is-narrow {
    transform: none;
  }
  /* Hug the copy column so the gap stays 3rem instead of centering. */
  .showcase:not(.is-reversed) .showcase-image.is-narrow img {
    margin-right: 0;
  }
  .showcase.is-reversed .showcase-image {
    transform: translateX(12%);
  }
}

/* ── Modules ── */
.module-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.625rem;
  max-width: 56rem;
  margin: 3rem 0 0;
  padding: 0;
  list-style: none;
}
.module-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: var(--glide-ink-2);
  font-size: 0.875rem;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}
.module-chip > :first-child {
  color: var(--glide-a1);
}
.module-chip:hover {
  border-color: rgba(45, 212, 191, 0.45);
  color: var(--glide-ink);
}

/* ── CTA ── */
.cta {
  padding-block: 8rem;
  text-align: center;
}
@media (min-width: 768px) {
  .cta {
    padding-block: 10rem;
  }
}
.cta-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: -1;
  width: 100%;
  max-width: 24rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgba(14, 165, 233, 0.5);
  filter: blur(160px);
  transform: translate(-50%, -50%);
}
.cta-icon {
  padding: 1rem;
  border-radius: 10px;
  background: linear-gradient(to bottom, #1f2937, #111827);
}
.cta-icon img {
  display: block;
  width: 6rem;
  height: 6rem;
}
.cta h2 {
  max-width: 36rem;
  margin: 2rem 0 0;
  text-wrap: balance;
  font-size: clamp(2.25rem, 5vw, 3rem);
  font-weight: 500;
  line-height: 1.1;
}
.cta-buttons {
  margin-top: 1.5rem;
}
</style>
