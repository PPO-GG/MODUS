<template>
  <div class="landing-layout">
    <!-- Navbar -->
    <header class="landing-navbar" :class="{ scrolled: isScrolled }">
      <nav class="landing-container landing-nav" aria-label="Main">
        <NuxtLink to="/" class="landing-brand" @click="handleLogoClick">
          <img src="/modus2-animated.svg" alt="" class="w-9 h-9" />
          <span>MODUS</span>
        </NuxtLink>

        <!-- Desktop -->
        <ul class="landing-links">
          <li v-for="link in navLinks" :key="link.href">
            <a
              :href="link.href"
              class="landing-link"
              @click="handleNavLinkClick($event, link.href)"
              >{{ link.label }}</a
            >
          </li>
          <li><NuxtLink to="/docs" class="landing-link">Docs</NuxtLink></li>
          <li>
            <NuxtLink to="/login" class="landing-link">Dashboard</NuxtLink>
          </li>
          <li>
            <a
              :href="botInviteUrl"
              target="_blank"
              rel="noopener"
              class="glide-btn"
            >
              <UIcon name="i-simple-icons-discord" class="w-4 h-4" />
              Add to Discord
            </a>
          </li>
        </ul>

        <!-- Mobile toggle -->
        <button
          type="button"
          class="landing-menu-btn"
          :aria-expanded="isMenuOpen"
          aria-label="Open menu"
          @click="isMenuOpen = true"
        >
          <UIcon name="i-lucide-menu" class="w-7 h-7" />
        </button>
      </nav>

      <!-- Mobile drawer -->
      <div
        class="landing-drawer"
        :class="isMenuOpen ? 'translate-x-0' : 'translate-x-full'"
        :aria-hidden="!isMenuOpen"
      >
        <button
          type="button"
          class="landing-menu-btn"
          aria-label="Close menu"
          @click="isMenuOpen = false"
        >
          <UIcon name="i-lucide-x" class="w-7 h-7" />
        </button>
        <ul class="grid justify-items-end gap-6 text-3xl">
          <li v-for="link in navLinks" :key="link.href">
            <a
              :href="link.href"
              @click="
                isMenuOpen = false;
                handleNavLinkClick($event, link.href);
              "
              >{{ link.label }}</a
            >
          </li>
          <li>
            <NuxtLink to="/docs" @click="isMenuOpen = false">Docs</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/login" @click="isMenuOpen = false"
              >Dashboard</NuxtLink
            >
          </li>
          <li>
            <a
              :href="botInviteUrl"
              target="_blank"
              rel="noopener"
              class="glide-btn text-xl"
              >Add to Discord</a
            >
          </li>
        </ul>
      </div>
    </header>

    <!-- Page Content -->
    <main class="flex-1 w-full">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="landing-footer">
      <nav class="landing-footer-nav" aria-label="Footer">
        <NuxtLink to="/" class="landing-brand" @click="handleLogoClick">
          <img src="/modus2-animated.svg" alt="" class="w-8 h-8" />
          <span>MODUS</span>
        </NuxtLink>
        <ul>
          <li><NuxtLink to="/docs">Docs</NuxtLink></li>
          <li><NuxtLink to="/xp">Leaderboards</NuxtLink></li>
          <li><NuxtLink to="/legal/terms">Terms</NuxtLink></li>
          <li><NuxtLink to="/legal/privacy">Privacy</NuxtLink></li>
          <li><NuxtLink to="/login">Dashboard</NuxtLink></li>
        </ul>
        <p>&copy; {{ new Date().getFullYear() }} MODUS</p>
      </nav>
    </footer>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const isScrolled = ref(false);
const isMenuOpen = ref(false);

useHead({
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossorigin: "",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&family=DM+Mono:wght@400;500&display=swap",
    },
  ],
});

const botInviteUrl = computed(() => {
  const clientId = config.public.discordClientId as string;
  if (!clientId) return "#";
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=8`;
});

// These links only have a matching section on the homepage. Elsewhere
// (e.g. /docs), let the browser navigate to "/#section" normally instead
// of trying to scroll a section that isn't on the current page.
const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Modules", href: "/#modules" },
  { label: "Leaderboards", href: "/xp" },
];

/**
 * Scroll to a homepage section, waiting for it to exist. After a
 * client-side navigation the target isn't in the DOM yet on the next tick,
 * so poll a few frames before giving up.
 */
const scrollToSection = async (hash: string) => {
  const id = hash.replace(/^\/?#/, "");
  for (let frame = 0; frame < 30; frame++) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

/**
 * Route these links through the router instead of letting the browser do a
 * document load. They were plain anchors, so every click re-booted the
 * whole app — and with it a session hydration that calls Discord's
 * ~1-req/s /users/@me/guilds. Two clicks inside a second was enough to
 * take a 429 and silently empty the user's guild list (see c84c8f0).
 *
 * The `href` stays on the anchor for crawlers and modified clicks; only a
 * plain left click is intercepted.
 */
const handleNavLinkClick = async (event: MouseEvent, href: string) => {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();

  const hashIndex = href.indexOf("#");
  const path = (hashIndex === -1 ? href : href.slice(0, hashIndex)) || "/";
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);

  // Arriving from another page: hand the hash to the router and let its
  // scroll behaviour place us, exactly as the browser did back when these
  // were document loads. Scrolling ourselves here just races it.
  if (route.path !== path) {
    await navigateTo(href);
    return;
  }

  // Already on the page, so no navigation happens and the scroll is ours.
  if (hash) await scrollToSection(hash);
};

const handleLogoClick = (event: MouseEvent) => {
  if (route.path === "/") {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

onMounted(() => {
  const handleScroll = () => {
    isScrolled.value = window.scrollY > 20;
  };
  window.addEventListener("scroll", handleScroll, { passive: true });
  onUnmounted(() => window.removeEventListener("scroll", handleScroll));
});
</script>

<style>
/* ============================================
   LANDING LAYOUT — "Glide" visual system
   Dark gray-950 ground with film grain, DM Sans,
   teal→sky accents, pill buttons, glass frames.
   Shared by index, /xp and /docs (.landing-container).
   ============================================ */

.landing-layout {
  --glide-bg: #030712;
  --glide-ink: #f9fafb;
  --glide-ink-2: #d1d5db;
  --glide-ink-3: #9ca3af;
  --glide-ink-4: #6b7280;
  --glide-line: rgba(243, 244, 246, 0.2);
  --glide-glass: rgba(229, 231, 235, 0.1);
  --glide-a1: #2dd4bf; /* teal-400 */
  --glide-a2: #38bdf8; /* sky-400 */
  --glide-a3: #22d3ee; /* cyan-400 */
  --glide-glow-1: rgba(3, 105, 161, 0.5); /* sky-700/50 */
  --glide-glow-2: rgba(13, 148, 136, 0.5); /* teal-600/50 */
  --glide-glow-solid: #0369a1;
  --glide-hot: #0284c7;
  --glide-icon-bg: #0c4a6e;
  --glide-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system,
    "Segoe UI", sans-serif;
  --glide-mono: "DM Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;

  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  color: var(--glide-ink);
  font-family: var(--glide-sans);
  background-color: var(--glide-bg);
  /* Specular-lit grain from the Glide template (public/assets). */
  background-image: url("/assets/noise-texture.svg");
  background-repeat: repeat;
  overflow-x: clip;
}

.landing-layout ::selection {
  background: rgba(45, 212, 191, 0.3);
}

.landing-container {
  max-width: 72rem;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 768px) {
  .landing-container {
    padding: 0 1.5rem;
  }
}

/* Navbar */
.landing-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
  border-bottom: 1px solid transparent;
}

.landing-navbar.scrolled {
  background: rgba(3, 7, 18, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.landing-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4.5rem;
  font-weight: 500;
}

.landing-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--glide-ink);
  z-index: 110;
}

.landing-links {
  display: none;
  align-items: center;
  gap: 1.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

@media (min-width: 820px) {
  .landing-links {
    display: flex;
  }
}

.landing-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: var(--glide-ink-2);
  transition: color 0.2s ease;
}

.landing-link:hover,
.landing-link.router-link-exact-active {
  color: var(--glide-ink);
}

.landing-menu-btn {
  display: inline-flex;
  padding: 0.5rem;
  color: var(--glide-ink);
  background: none;
  border: 0;
  cursor: pointer;
}

@media (min-width: 820px) {
  .landing-menu-btn {
    display: none;
  }
}

.landing-drawer {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2rem;
  padding: 1.25rem 1rem;
  background: var(--glide-bg);
  transition: transform 0.3s ease-in-out;
}

@media (min-width: 820px) {
  .landing-drawer {
    display: none;
  }
}

/* Pill button (Glide .buttonLink) */
.glide-btn {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.5rem 1.125rem;
  border-radius: 9999px;
  border: 1px solid rgba(224, 242, 254, 0.2);
  background: rgba(186, 230, 253, 0.1);
  color: #bae6fd;
  font-weight: 500;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;
}

.glide-btn::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 9999px;
  background: #ccfbf1;
  opacity: 0;
  filter: blur(12px);
  transition: opacity 0.5s ease;
}

.glide-btn:hover {
  color: #5eead4;
  border-color: rgba(153, 246, 228, 0.4);
}

.glide-btn:hover::after {
  opacity: 0.15;
}

.glide-btn:focus-visible {
  outline: 2px solid #5eead4;
  outline-offset: 2px;
}

.glide-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--glide-ink-2);
}

.glide-btn-ghost:hover {
  color: var(--glide-ink);
  border-color: transparent;
}

/* Glass frame (Glide .glass-container) */
.glide-glass {
  position: relative;
  isolation: isolate;
}

.glide-glass::before {
  content: "";
  position: absolute;
  inset: -10px;
  z-index: -1;
  border-radius: 14px;
  border: 1px solid var(--glide-line);
  background: var(--glide-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Gradient emphasis (Glide GlideText) */
.glide-text {
  font-style: normal;
  background: linear-gradient(to bottom, var(--glide-a1), var(--glide-a2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* Footer */
.landing-footer-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.75rem 1rem;
  border-top: 1px solid #4b5563;
}

@media (min-width: 768px) {
  .landing-footer-nav {
    flex-direction: row;
    padding: 1.75rem 2rem;
  }
}

.landing-footer-nav ul {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 1.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  color: var(--glide-ink-2);
}

.landing-footer-nav li a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  transition: color 0.2s ease;
}

.landing-footer-nav li a:hover {
  color: var(--glide-ink);
}

.landing-footer-nav p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--glide-ink-4);
}
</style>
