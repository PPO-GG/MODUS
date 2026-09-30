import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repos } from './db'

const sdk = vi.hoisted(() => ({
  openaiCtor: vi.fn(),
  openaiCreate: vi.fn(),
  anthropicCtor: vi.fn(),
  anthropicCreate: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: sdk.openaiCreate } }
    constructor(options: unknown) {
      sdk.openaiCtor(options)
    }
  },
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: sdk.anthropicCreate }
    constructor(options: unknown) {
      sdk.anthropicCtor(options)
    }
  },
}))

import { completeGuildText, resolveGuildAi, resolveProviderBaseUrl } from './guild-ai'

function fakeRepos(options: {
  settings?: Record<string, unknown>
  premium?: boolean
  global?: Record<string, unknown> | null
}) {
  const getGlobalAIConfig = vi.fn(async () => options.global ?? null)
  const repos = {
    guildConfigs: {
      getModuleSettings: vi.fn(async () => options.settings ?? {}),
      getGlobalAIConfig,
    },
    servers: { isPremium: vi.fn(async () => options.premium ?? false) },
  } as unknown as Pick<Repos, 'guildConfigs' | 'servers'>
  return { repos, getGlobalAIConfig }
}

describe('resolveGuildAi', () => {
  it("uses the guild's own key, provider and model", async () => {
    const { repos } = fakeRepos({
      settings: { aiApiKey: ' sk-guild ', aiProvider: 'OpenAI', aiModel: 'gpt-4o', aiBaseUrl: '', maxOutputTokens: 2000 },
    })
    await expect(resolveGuildAi(repos, 'g1')).resolves.toEqual({
      ok: true,
      provider: 'OpenAI',
      apiKey: 'sk-guild',
      model: 'gpt-4o',
      baseUrl: '',
      keySource: 'guild',
      maxOutputTokens: 2000,
    })
  })

  it('falls back to schema defaults for a guild key with no provider or model saved', async () => {
    const { repos } = fakeRepos({ settings: { aiApiKey: 'k' } })
    await expect(resolveGuildAi(repos, 'g1')).resolves.toMatchObject({
      provider: 'Groq',
      model: 'llama-3.3-70b-versatile',
      maxOutputTokens: 1024,
    })
  })

  it('clamps the output token cap to 1024-4096', async () => {
    const low = fakeRepos({ settings: { aiApiKey: 'k', maxOutputTokens: 512 } })
    const high = fakeRepos({ settings: { aiApiKey: 'k', maxOutputTokens: 100000 } })
    await expect(resolveGuildAi(low.repos, 'g1')).resolves.toMatchObject({ maxOutputTokens: 1024 })
    await expect(resolveGuildAi(high.repos, 'g1')).resolves.toMatchObject({ maxOutputTokens: 4096 })
  })

  it('prefers the guild key even when the guild is premium', async () => {
    const { repos } = fakeRepos({
      settings: { aiApiKey: 'guild-key' },
      premium: true,
      global: { aiApiKey: 'shared-key' },
    })
    await expect(resolveGuildAi(repos, 'g1')).resolves.toMatchObject({ keySource: 'guild', apiKey: 'guild-key' })
  })

  it('treats a whitespace-only guild key as missing and never reads the global config for non-premium guilds', async () => {
    const { repos, getGlobalAIConfig } = fakeRepos({
      settings: { aiApiKey: '   ' },
      premium: false,
      global: { aiApiKey: 'shared-key' },
    })
    await expect(resolveGuildAi(repos, 'g1')).resolves.toEqual({ ok: false, reason: 'not_premium' })
    expect(getGlobalAIConfig).not.toHaveBeenCalled()
  })

  it('uses the global config for premium guilds without their own key', async () => {
    const { repos } = fakeRepos({
      premium: true,
      global: { aiApiKey: 'shared-key', aiProvider: 'Anthropic Claude', aiModel: 'claude-sonnet-4', aiBaseUrl: '', maxOutputTokens: 800 },
    })
    await expect(resolveGuildAi(repos, 'g1')).resolves.toEqual({
      ok: true,
      provider: 'Anthropic Claude',
      apiKey: 'shared-key',
      model: 'claude-sonnet-4',
      baseUrl: '',
      keySource: 'shared',
      maxOutputTokens: 1024,
    })
  })

  it.each([
    ['no global config row', null],
    ['a global config with no key', { aiProvider: 'Groq' }],
    ['a global config with a blank key', { aiApiKey: '  ' }],
  ])('reports no_shared_key for a premium guild with %s', async (_label, global) => {
    const { repos } = fakeRepos({ premium: true, global })
    await expect(resolveGuildAi(repos, 'g1')).resolves.toEqual({ ok: false, reason: 'no_shared_key' })
  })
})

describe('resolveProviderBaseUrl', () => {
  it.each([
    ['OpenAI', '', 'https://api.openai.com/v1'],
    ['Google Gemini', '', 'https://generativelanguage.googleapis.com/v1beta/openai/'],
    ['Groq', '', 'https://api.groq.com/openai/v1'],
    ['Something Else', '', 'https://api.openai.com/v1'],
    ['OpenAI Compatible', '', 'http://localhost:11434/v1'],
    ['OpenAI Compatible', 'https://llm.example.com/v1', 'https://llm.example.com/v1'],
  ])('maps %s (%s) to %s', (provider, custom, expected) => {
    expect(resolveProviderBaseUrl(provider, custom)).toBe(expected)
  })

  it.each(['ftp://example.com', 'file:///etc/passwd', 'not a url'])('rejects custom URL %s', (custom) => {
    expect(() => resolveProviderBaseUrl('OpenAI Compatible', custom)).toThrow(/base URL/)
  })
})

describe('completeGuildText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const base = {
    apiKey: 'k',
    model: 'm',
    baseUrl: '',
    system: 'SYS',
    user: 'USER',
    maxOutputTokens: 1024,
  }

  it('calls OpenAI-compatible providers with the resolved base URL and no temperature', async () => {
    sdk.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 11, completion_tokens: 22 },
    })
    const result = await completeGuildText({ ...base, provider: 'Groq' })
    expect(sdk.openaiCtor).toHaveBeenCalledWith({ apiKey: 'k', baseURL: 'https://api.groq.com/openai/v1' })
    expect(sdk.openaiCreate).toHaveBeenCalledWith({
      model: 'm',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'USER' },
      ],
    })
    expect(result).toEqual({ text: 'hello', inputTokens: 11, outputTokens: 22 })
  })

  it('returns empty text when the provider sends no content', async () => {
    sdk.openaiCreate.mockResolvedValue({ choices: [], usage: undefined })
    await expect(completeGuildText({ ...base, provider: 'OpenAI' })).resolves.toEqual({
      text: '',
      inputTokens: 0,
      outputTokens: 0,
    })
  })

  it('calls Anthropic with a system prompt and joins text blocks', async () => {
    sdk.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'a' }, { type: 'tool_use' }, { type: 'text', text: 'b' }],
      usage: { input_tokens: 5, output_tokens: 6 },
    })
    const result = await completeGuildText({ ...base, provider: 'Anthropic Claude' })
    expect(sdk.anthropicCtor).toHaveBeenCalledWith({ apiKey: 'k' })
    expect(sdk.anthropicCreate).toHaveBeenCalledWith({
      model: 'm',
      max_tokens: 1024,
      system: 'SYS',
      messages: [{ role: 'user', content: 'USER' }],
    })
    expect(result).toEqual({ text: 'ab', inputTokens: 5, outputTokens: 6 })
  })

  it('rejects an invalid custom base URL before making a request', async () => {
    await expect(
      completeGuildText({ ...base, provider: 'OpenAI Compatible', baseUrl: 'ftp://x' }),
    ).rejects.toThrow(/base URL/)
    expect(sdk.openaiCreate).not.toHaveBeenCalled()
  })
})
