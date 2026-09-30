<template>
  <div class="auth-status">
    <UIcon
      name="i-lucide-loader-circle"
      class="auth-status-icon animate-spin"
    />
    <p class="text-[var(--glide-ink-2)] font-medium">Completing login...</p>
    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const userStore = useUserStore();
const router = useRouter();
const route = useRoute();
const error = ref("");

onMounted(async () => {
  try {
    // Session cookies were set by the server-side callback handler (/api/auth/callback).
    // Now we fetch the session details to hydrate the user store.
    await userStore.fetchUserSession();

    if (userStore.isLoggedIn) {
      const returnTo = route.query.returnTo;
      const destination =
        typeof returnTo === "string" && /^\/(?!\/)/.test(returnTo)
          ? returnTo
          : "/dashboard";
      router.push(destination);
    } else {
      error.value = "Login failed. Please try again.";
      setTimeout(() => router.push("/login"), 2000);
    }
  } catch (err: any) {
    console.error("Auth callback failed:", err);
    error.value = err.message || "Authentication failed.";
    setTimeout(() => router.push("/login?error=auth_failed"), 2000);
  }
});
</script>
