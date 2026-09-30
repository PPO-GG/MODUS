<template>
  <div class="auth-status">
    <UIcon
      name="i-lucide-loader-circle"
      class="auth-status-icon animate-spin"
    />
    <p>Redirecting to login...</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

useHead({ title: "Redirecting…" });

const router = useRouter();

// Immediately redirect to login page since we only support Discord auth
onMounted(() => {
  router.push("/login");
});
</script>
