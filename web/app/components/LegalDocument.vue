<template>
  <div class="landing-container">
    <article class="legal-doc">
      <header class="legal-header">
        <p class="legal-eyebrow">
          <UIcon :name="icon" class="w-4 h-4" />
          {{ eyebrow }}
        </p>
        <h1>
          {{ titleLead }}
          <em class="glide-text">{{ titleTail }}</em>
        </h1>
        <p class="legal-updated">Last updated: {{ updated }}</p>
      </header>

      <div class="legal-body">
        <slot />
      </div>

      <footer class="legal-footer">
        <NuxtLink :to="related.to" class="legal-footer-accent">
          <UIcon :name="related.icon" class="w-4 h-4" />
          {{ related.label }}
        </NuxtLink>
        <NuxtLink to="/">
          <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
          Back to Home
        </NuxtLink>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  eyebrow: string;
  icon: string;
  title: string;
  updated: string;
  related: { to: string; label: string; icon: string };
}>();

// The last word of the title gets the Glide gradient emphasis.
const titleLead = computed(() => props.title.split(" ").slice(0, -1).join(" "));
const titleTail = computed(() => props.title.split(" ").at(-1));
</script>

<style>
/* ============================================
   LEGAL DOCUMENT — long-form reading pages
   (Terms, Privacy) on the Glide landing layout.
   Content is plain h2 / p / ul / li / a / strong;
   everything is styled from here.
   ============================================ */

.legal-doc {
  max-width: 44rem;
  margin: 0 auto;
  /* Clear the fixed landing navbar. */
  padding: 9rem 0 5rem;
}

.legal-header {
  margin-bottom: 3rem;
  text-align: center;
}

.legal-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  padding: 0.375rem 1rem;
  border-radius: 9999px;
  border: 1px solid rgba(224, 242, 254, 0.2);
  background: rgba(186, 230, 253, 0.1);
  color: #bae6fd;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.legal-header h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(2.25rem, 6vw, 3.5rem);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
  color: var(--glide-ink);
}

.legal-updated {
  margin: 0;
  font-size: 0.875rem;
  color: var(--glide-ink-4);
}

.legal-body {
  color: var(--glide-ink-3);
  font-size: 0.9375rem;
  line-height: 1.8;
}

.legal-body section {
  padding: 2rem 0;
  border-top: 1px solid var(--glide-line);
}

.legal-body section:first-child {
  border-top: 0;
  padding-top: 0;
}

.legal-body h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--glide-ink);
}

.legal-body p {
  margin: 0;
}

.legal-body p + p {
  margin-top: 0.75rem;
}

.legal-body ul {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
}

.legal-body li {
  position: relative;
  padding-left: 1.25rem;
}

.legal-body li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.8em;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--glide-a1);
  opacity: 0.6;
}

.legal-body strong {
  font-weight: 500;
  color: var(--glide-ink-2);
}

.legal-body strong.legal-em {
  color: var(--glide-ink);
}

.legal-body a {
  color: var(--glide-a1);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.2s ease;
}

.legal-body a:hover {
  color: #5eead4;
}

/* Highlighted statement (e.g. "We do not sell your data"). */
.legal-body section.legal-callout {
  margin: 1rem 0;
  padding: 1.5rem;
  border: 1px solid rgba(45, 212, 191, 0.25);
  border-radius: 1rem;
  background: rgba(45, 212, 191, 0.06);
}

.legal-body section.legal-callout + section {
  border-top: 0;
}

.legal-body .legal-callout-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--glide-a1);
}

.legal-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--glide-line);
  font-size: 0.875rem;
}

@media (min-width: 640px) {
  .legal-footer {
    flex-direction: row;
  }
}

.legal-footer a {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.75rem;
  color: var(--glide-ink-3);
  transition: color 0.2s ease;
}

.legal-footer a:hover {
  color: var(--glide-ink);
}

.legal-footer a.legal-footer-accent {
  color: var(--glide-a1);
}

.legal-footer a.legal-footer-accent:hover {
  color: #5eead4;
}
</style>
