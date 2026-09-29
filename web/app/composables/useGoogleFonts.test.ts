import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#shared/fonts', () => ({
  GOOGLE_FONTS: [{ family: 'Bebas Neue', category: 'display', weights: [400] }],
  SYSTEM_FONTS: [{ family: 'Arial', category: 'sans-serif' }],
  isSystemFont: (family: string) => family === 'Arial',
  googleFontsCssUrl: (family: string) => `https://fonts.example/${family}`,
}))

type Listener = () => void

class FakeLink {
  rel = ''
  href = ''
  dataset: Record<string, string> = {}
  removed = false
  private listeners: Record<string, Listener[]> = {}
  addEventListener(type: string, fn: Listener) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== fn)
  }
  fire(type: string) {
    for (const fn of [...(this.listeners[type] ?? [])]) fn()
  }
  remove() {
    this.removed = true
  }
}

let links: FakeLink[]
let fontsLoad: ReturnType<typeof vi.fn>
// Faces the fake FontFaceSet reports; only non-empty once the stylesheet loaded.
let stylesheetLoaded: boolean

async function freshComposable() {
  vi.resetModules()
  const mod = await import('./useGoogleFonts')
  return mod.useGoogleFonts()
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  links = []
  stylesheetLoaded = false
  fontsLoad = vi.fn(async () => (stylesheetLoaded ? [{}] : []))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      const link = new FakeLink()
      if (tag === 'link') links.push(link)
      return link
    },
    head: { appendChild: () => {} },
    fonts: { load: fontsLoad },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useGoogleFonts.loadFont', () => {
  it('waits for the stylesheet before loading faces', async () => {
    const { loadFont, loadedFonts } = await freshComposable()
    const done = loadFont('Bebas Neue')
    await flush()
    expect(fontsLoad).not.toHaveBeenCalled()

    stylesheetLoaded = true
    links[0]!.fire('load')
    await done

    expect(fontsLoad).toHaveBeenCalledWith('400 16px "Bebas Neue"')
    expect(loadedFonts.has('Bebas Neue')).toBe(true)
  })

  it('shares one in-flight load between concurrent callers', async () => {
    const { loadFont, loadedFonts } = await freshComposable()
    const a = loadFont('Bebas Neue')
    const b = loadFont('Bebas Neue')
    expect(b).toBe(a)
    expect(links).toHaveLength(1)

    stylesheetLoaded = true
    links[0]!.fire('load')
    await Promise.all([a, b])
    expect(loadedFonts.has('Bebas Neue')).toBe(true)
  })

  it('does not cache a load that yields no font faces, and retries later', async () => {
    const { loadFont, loadedFonts } = await freshComposable()
    const first = loadFont('Bebas Neue')
    links[0]!.fire('load') // stylesheet "loaded" but no faces registered
    await first
    expect(loadedFonts.has('Bebas Neue')).toBe(false)
    expect(links[0]!.removed).toBe(true)

    const second = loadFont('Bebas Neue')
    expect(links).toHaveLength(2)
    stylesheetLoaded = true
    links[1]!.fire('load')
    await second
    expect(loadedFonts.has('Bebas Neue')).toBe(true)
  })

  it('resolves without caching on stylesheet error', async () => {
    const { loadFont, loadedFonts } = await freshComposable()
    const done = loadFont('Bebas Neue')
    links[0]!.fire('error')
    await expect(done).resolves.toBeUndefined()
    expect(fontsLoad).not.toHaveBeenCalled()
    expect(loadedFonts.has('Bebas Neue')).toBe(false)
  })

  it('gives up after a timeout if the stylesheet never loads', async () => {
    vi.useFakeTimers()
    const { loadFont, loadedFonts, loadingFonts } = await freshComposable()
    const done = loadFont('Bebas Neue')
    expect(loadingFonts.value.has('Bebas Neue')).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    await done
    expect(fontsLoad).not.toHaveBeenCalled()
    expect(loadedFonts.has('Bebas Neue')).toBe(false)
    expect(loadingFonts.value.has('Bebas Neue')).toBe(false)
  })

  it('skips system fonts', async () => {
    const { loadFont } = await freshComposable()
    await loadFont('Arial')
    expect(links).toHaveLength(0)
  })
})
