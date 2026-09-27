export interface DocsCommandOption {
  name: string;
  description: string;
  type: string;
  required: boolean;
  options: DocsCommandOption[];
}

export interface DocsCommand {
  name: string;
  description: string;
  options: DocsCommandOption[];
}

export interface DocsModule {
  name: string;
  description: string;
  commands: DocsCommand[];
}

/**
 * Fetches the module/command catalog for the public /docs pages. Cached by
 * Nuxt's useFetch under a shared key so /docs and /docs/[module] reuse one
 * request instead of both fetching independently.
 */
export function useDocs() {
  const request = useFetch<DocsModule[]>("/api/docs/modules", {
    key: "docs-modules",
  });

  return {
    modules: request.data,
    pending: request.pending,
    error: request.error,
    // Await when something must read the data during setup (e.g. OG image
    // props, which are captured once rather than tracked reactively).
    ready: Promise.resolve(request).then(() => {}),
  };
}
