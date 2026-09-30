<template>
  <div class="auth-layout glide-grain">
    <!-- Ambient glows -->
    <div class="auth-glow auth-glow-a" aria-hidden="true"></div>
    <div class="auth-glow auth-glow-b" aria-hidden="true"></div>

    <div class="auth-shell">
      <NuxtLink to="/" class="auth-brand" aria-label="MODUS home">
        <img src="/modus2-animated.svg" alt="" class="w-14 h-14" />
        <span>MODUS</span>
      </NuxtLink>

      <main class="auth-main">
        <slot />
      </main>

      <footer class="auth-footer">
        <NuxtLink to="/legal/terms">Terms</NuxtLink>
        <NuxtLink to="/legal/privacy">Privacy</NuxtLink>
      </footer>
    </div>
  </div>
</template>

<style>
/* ============================================
   AUTH LAYOUT — "Glide" visual system
   Shares the landing ground (grain, DM Sans,
   teal→sky accents) and the .glide-glass frame.
   ============================================ */

.auth-layout {
  position: relative;
  min-height: 100vh;
  width: 100%;
  color: var(--glide-ink);
  font-family: var(--glide-sans);
  overflow: hidden;
}

.auth-layout ::selection {
  background: rgba(45, 212, 191, 0.3);
}

.auth-glow {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.auth-glow-a {
  top: -12rem;
  left: 50%;
  width: 40rem;
  height: 26rem;
  transform: translateX(-50%);
  background: var(--glide-glow-1);
  filter: blur(140px);
  opacity: 0.35;
}

.auth-glow-b {
  bottom: -10rem;
  right: -6rem;
  width: 28rem;
  height: 22rem;
  background: var(--glide-glow-2);
  filter: blur(130px);
  opacity: 0.25;
}

.auth-shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem;
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--glide-ink);
}

.auth-main {
  flex: 1;
  width: 100%;
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2rem 0;
}

.auth-footer {
  display: flex;
  gap: 1.5rem;
  font-size: 0.8125rem;
  color: var(--glide-ink-4);
}

.auth-footer a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  transition: color 0.2s ease;
}

.auth-footer a:hover {
  color: var(--glide-ink);
}

/* Shared by login, register and callback status screens. */
.auth-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  color: var(--glide-ink-3);
  font-size: 0.875rem;
}

.auth-status-icon {
  width: 2rem;
  height: 2rem;
  color: var(--glide-a1);
}

@media (prefers-reduced-motion: reduce) {
  .auth-status-icon {
    animation: none;
  }
}
</style>
