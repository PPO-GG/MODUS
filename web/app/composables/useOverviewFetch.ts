/** Self-contained loader for one Overview section: data, loading, error, reload. */
export function useOverviewFetch<T>(url: () => string) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function reload() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await $fetch<T>(url());
    } catch (err: any) {
      error.value = err?.statusMessage || err?.message || "Request failed";
    } finally {
      loading.value = false;
    }
  }

  onMounted(reload);
  return { data, loading, error, reload };
}
