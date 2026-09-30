<template>
  <div>
    <!-- Loading spinner while checking session -->
    <div v-if="!userStore.initialized" class="auth-status">
      <UIcon
        name="i-lucide-loader-circle"
        class="auth-status-icon animate-spin"
      />
      <p>Checking session...</p>
    </div>

    <!-- Main Login Card -->
    <div v-else class="glide-glass auth-card">
      <div class="text-center mb-8">
        <h1 class="auth-title">
          Welcome <em class="glide-text">back</em>
        </h1>
        <p class="auth-sub">
          Sign in with Discord to access your MODUS dashboard
        </p>
      </div>

      <!-- Discord Login Button -->
      <button
        type="button"
        class="glide-btn auth-discord-btn"
        :disabled="userStore.loading"
        @click="loginWithDiscord"
      >
        <UIcon
          v-if="!userStore.loading"
          name="i-simple-icons-discord"
          class="w-5 h-5"
        />
        <UIcon
          v-else
          name="i-lucide-loader-circle"
          class="w-5 h-5 animate-spin"
        />
        <span>{{
          userStore.loading ? "Connecting..." : "Continue with Discord"
        }}</span>
      </button>

      <p class="auth-legal">
        By signing in, you agree to our
        <NuxtLink to="/legal/terms">Terms</NuxtLink>
        and
        <NuxtLink to="/legal/privacy">Privacy Policy</NuxtLink>
      </p>

      <!-- Feature highlights -->
      <ul class="auth-features">
        <li>
          <span class="auth-feature-icon">
            <UIcon name="i-lucide-shield-check" class="w-4 h-4" />
          </span>
          Secure authentication via Discord OAuth
        </li>
        <li>
          <span class="auth-feature-icon">
            <UIcon name="i-lucide-zap" class="w-4 h-4" />
          </span>
          Instant access to your bot configurations
        </li>
        <li>
          <span class="auth-feature-icon">
            <UIcon name="i-lucide-sliders-horizontal" class="w-4 h-4" />
          </span>
          Manage modules, commands, and permissions
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

useHead({ title: "Sign In" });

const userStore = useUserStore();
const router = useRouter();

// Once initialized, if already logged in, redirect
watch(
  () => userStore.initialized,
  (ready) => {
    if (ready && userStore.isLoggedIn) {
      router.push("/dashboard");
    }
  },
  { immediate: true },
);

// Also watch isLoggedIn in case it changes after init
watch(
  () => userStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      router.push("/dashboard");
    }
  },
);

const loginWithDiscord = () => {
  try {
    userStore.loginWithDiscord();
  } catch (error) {
    console.error("Discord login failed:", error);
  }
};
</script>

<style scoped>
/* Leave room for the .glide-glass frame, which bleeds 10px outside. */
.auth-card {
  margin: 10px;
  padding: 0.5rem 0.25rem;
}

.auth-title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--glide-ink);
  margin-bottom: 0.5rem;
}

.auth-sub {
  font-size: 0.9375rem;
  color: var(--glide-ink-3);
}

.auth-discord-btn {
  width: 100%;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
}

.auth-discord-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-legal {
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--glide-ink-4);
}

.auth-legal a {
  color: var(--glide-ink-2);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.auth-legal a:hover {
  color: var(--glide-a1);
}

.auth-features {
  list-style: none;
  margin: 2rem 0 0;
  padding: 1.5rem 0 0;
  border-top: 1px solid var(--glide-line);
  display: grid;
  gap: 0.75rem;
}

.auth-features li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--glide-ink-3);
}

.auth-feature-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: var(--glide-icon-bg);
  color: var(--glide-a1);
}
</style>
