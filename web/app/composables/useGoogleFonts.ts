/**
 * Client-side Google Fonts composable.
 *
 * Dynamically loads Google Font CSS into the page <head> for
 * Konva preview rendering. Fonts are loaded on-demand and cached
 * in a reactive Set to avoid duplicate <link> injections.
 */
import { ref } from "vue";
import {
  GOOGLE_FONTS,
  SYSTEM_FONTS,
  isSystemFont,
  googleFontsCssUrl,
  type FontDefinition,
} from "#shared/fonts";

// ── Module-level cache (persists across component remounts) ──────

const loadedFonts = new Set<string>();
const loadingFonts = ref(new Set<string>());
// In-flight loads, so concurrent callers for the same family share one attempt.
const pendingLoads = new Map<string, Promise<void>>();

const STYLESHEET_TIMEOUT_MS = 10_000;

/**
 * Resolve once the <link> stylesheet has loaded and its @font-face rules
 * are registered. Rejects on network error or timeout.
 */
function waitForStylesheet(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      link.removeEventListener("load", onLoad);
      link.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("stylesheet failed to load"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("stylesheet load timed out"));
    }, STYLESHEET_TIMEOUT_MS);
    link.addEventListener("load", onLoad);
    link.addEventListener("error", onError);
  });
}

async function fetchFont(family: string): Promise<void> {
  const fontDef = GOOGLE_FONTS.find((f) => f.family === family);
  const weights = fontDef?.weights ?? [400, 700];

  // A fresh <link> per attempt: a link whose load event already fired can't
  // be awaited, and a failed one should be retried from scratch.
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = googleFontsCssUrl(family, weights);
  link.dataset.googleFont = family;
  const stylesheetReady = waitForStylesheet(link);
  document.head.appendChild(link);

  try {
    await stylesheetReady;
    // document.fonts.load resolves with [] (not an error) when no matching
    // @font-face exists, so an empty result means the font isn't usable.
    const faces = await Promise.all(
      weights.map((weight) =>
        document.fonts.load(`${weight} 16px "${family}"`),
      ),
    );
    if (faces.some((f) => f.length > 0)) {
      loadedFonts.add(family);
    } else {
      link.remove();
      console.warn(`[GoogleFonts] No font faces found for: ${family}`);
    }
  } catch (err) {
    link.remove();
    console.warn(`[GoogleFonts] Failed to load font: ${family}`, err);
  }
}

// ── Font Groups for the picker ───────────────────────────────────

export interface FontGroup {
  label: string;
  fonts: FontDefinition[];
}

function buildFontGroups(): FontGroup[] {
  const featured = GOOGLE_FONTS.filter((f) => f.featured);
  const sansSerif = GOOGLE_FONTS.filter(
    (f) => f.category === "sans-serif" && !f.featured,
  );
  const serif = GOOGLE_FONTS.filter(
    (f) => f.category === "serif" && !f.featured,
  );
  const display = GOOGLE_FONTS.filter(
    (f) => f.category === "display" && !f.featured,
  );
  const handwriting = GOOGLE_FONTS.filter(
    (f) => f.category === "handwriting" && !f.featured,
  );
  const monospace = GOOGLE_FONTS.filter(
    (f) => f.category === "monospace" && !f.featured,
  );

  return [
    { label: "System", fonts: SYSTEM_FONTS },
    { label: "Featured", fonts: featured },
    { label: "Sans-Serif", fonts: sansSerif },
    { label: "Serif", fonts: serif },
    { label: "Display", fonts: display },
    { label: "Handwriting", fonts: handwriting },
    { label: "Monospace", fonts: monospace },
  ].filter((g) => g.fonts.length > 0);
}

// ── Composable ───────────────────────────────────────────────────

export function useGoogleFonts() {
  const fontGroups = buildFontGroups();

  /**
   * Load a Google Font and resolve once the browser confirms it is
   * actually usable — not just that the stylesheet request completed.
   * No-op for system fonts or already-loaded fonts. Concurrent calls for
   * the same family share one in-flight load. Never rejects; a failed
   * load is not cached, so a later call retries.
   */
  function loadFont(family: string): Promise<void> {
    if (isSystemFont(family)) return Promise.resolve();
    if (loadedFonts.has(family)) return Promise.resolve();

    const pending = pendingLoads.get(family);
    if (pending) return pending;

    loadingFonts.value.add(family);
    const load = fetchFont(family).finally(() => {
      pendingLoads.delete(family);
      loadingFonts.value.delete(family);
    });
    pendingLoads.set(family, load);
    return load;
  }

  /**
   * Load all fonts referenced in a template's elements, resolving once
   * every one of them is actually ready to draw.
   */
  async function loadTemplateFonts(
    elements: { fontFamily?: string }[],
  ): Promise<void> {
    const families = new Set<string>();
    for (const el of elements) {
      if (el.fontFamily) families.add(el.fontFamily);
    }
    await Promise.all(Array.from(families, loadFont));
  }

  return {
    fontGroups,
    loadFont,
    loadTemplateFonts,
    loadingFonts,
    loadedFonts,
  };
}
