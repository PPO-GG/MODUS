import { describe, expect, it, vi } from 'vitest'
import type { GuildContext } from '@modus/db/automod-rules'
import { createDraftHandler, createDraftStatusHandler, DRAFT_COOLDOWN_MS, type DraftDeps } from './automod-draft'

const ctx: GuildContext = {
  roles: [{ id: '111', name: 'Moderator' }],
  channels: [{ id: '333', name: 'general' }],
}

const validReply = {
  name: 'Link spam',
  trigger: 'message_create',
  conditions: {
    operator: 'AND',
    conditions: [{ type: 'condition', field: 'message.links_count', operator: 'greater_than', value: 2 }],
  },
  actions: [{ type: 'delete_message' }],
  exempt_roles: ['111'],
  exempt_channels: [],
  cooldown: 0,
  priority: 0,
  notes: ['ok'],
}

const okAi = {
  ok: true as const,
  provider: 'Groq',
  apiKey: 'secret-key',
  model: 'm',
  baseUrl: '',
  keySource: 'shared' as const,
  maxOutputTokens: 1024,
}

const reply = (text: string) => ({ text, inputTokens: 10, outputTokens: 20 })

function makeDeps(over: Partial<DraftDeps<object>> = {}) {
  const log = vi.fn(async () => undefined)
  const clock = { t: 1_000_000 }
  const deps: DraftDeps<object> = {
    readBody: async () => ({ guild_id: 'g1', prompt: 'delete messages with more than 2 links' }),
    getQuery: () => ({ guild_id: 'g1' }),
    requireModuleAccess: vi.fn(async () => ({ userId: 'u1' })),
    getRepos: () => ({ aiUsage: { log } }) as any,
    resolveGuildAi: vi.fn(async () => okAi),
    completeText: vi.fn(async () => reply(JSON.stringify(validReply))),
    fetchGuildContext: vi.fn(async () => ctx),
    now: () => clock.t,
    createHttpError: (statusCode, statusMessage, data) =>
      Object.assign(new Error(statusMessage), { statusCode, statusMessage, data }),
    logError: vi.fn(),
    ...over,
  }
  return { deps, log, clock }
}

const event = {}

describe('createDraftHandler', () => {
  it('returns the validated rule, warnings and notes, and logs usage', async () => {
    const { deps, log } = makeDeps()
    const result = await createDraftHandler(deps)(event)
    expect(result.rule).toMatchObject({ name: 'Link spam', trigger: 'message_create', exempt_roles: ['111'] })
    expect(result.warnings).toEqual([])
    expect(result.notes).toEqual(['ok'])
    expect(deps.completeText).toHaveBeenCalledTimes(1)
    const call = (deps.completeText as any).mock.calls[0][0]
    expect(call.system).toContain('message.links_count')
    expect(call.user).toContain('delete messages with more than 2 links')
    expect(call.maxOutputTokens).toBe(1024)
    expect(log).toHaveBeenCalledWith({
      guildId: 'g1',
      userId: 'u1',
      provider: 'Groq',
      model: 'm',
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      action: 'automod_draft',
      key_source: 'shared',
    })
  })

  it('accepts a reply wrapped in prose and code fences', async () => {
    const { deps } = makeDeps({
      completeText: vi.fn(async () => reply('Sure!\n```json\n' + JSON.stringify(validReply) + '\n```')),
    })
    await expect(createDraftHandler(deps)(event)).resolves.toMatchObject({ rule: { name: 'Link spam' } })
  })

  it.each([
    ['empty text', ''],
    ['prose with no JSON', 'I am sorry, I cannot help with that.'],
    ['JSON truncated by the token limit', JSON.stringify(validReply).slice(0, 60)],
  ])('repairs once when the first reply is %s', async (_label, firstText) => {
    const completeText = vi
      .fn()
      .mockResolvedValueOnce(reply(firstText))
      .mockResolvedValueOnce(reply(JSON.stringify(validReply)))
    const { deps, log } = makeDeps({ completeText })
    await expect(createDraftHandler(deps)(event)).resolves.toMatchObject({ rule: { name: 'Link spam' } })
    expect(completeText).toHaveBeenCalledTimes(2)
    const second = completeText.mock.calls[1]![0]
    expect(second.user).toContain('delete messages with more than 2 links')
    expect(second.user).toContain('Problems:')
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('repairs when the first reply parses but fails validation', async () => {
    const bad = { ...validReply, trigger: 'voice_join' }
    const completeText = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify(bad)))
      .mockResolvedValueOnce(reply(JSON.stringify(validReply)))
    const { deps } = makeDeps({ completeText })
    await createDraftHandler(deps)(event)
    expect(completeText.mock.calls[1]![0].user).toContain('trigger: must be one of')
  })

  it('returns 422 with the validator errors when the repair also fails, without leaking raw provider text', async () => {
    const bad = { ...validReply, trigger: 'voice_join', leaked: 'SECRET-PROVIDER-TEXT' }
    const { deps } = makeDeps({ completeText: vi.fn(async () => reply(JSON.stringify(bad))) })
    const error: any = await createDraftHandler(deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(422)
    expect(error.data.errors.join('\n')).toMatch(/trigger: must be one of/)
    expect(JSON.stringify(error)).not.toContain('SECRET-PROVIDER-TEXT')
    expect(deps.completeText).toHaveBeenCalledTimes(2)
  })

  it('returns a generic 502 when the provider call throws', async () => {
    const { deps } = makeDeps({
      completeText: vi.fn(async () => {
        throw new Error('401 invalid api key secret-key')
      }),
    })
    const error: any = await createDraftHandler(deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(502)
    expect(error.statusMessage).not.toContain('secret-key')
    expect(deps.logError).toHaveBeenCalled()
  })

  it('returns 502 when roles and channels cannot be loaded', async () => {
    const { deps } = makeDeps({
      fetchGuildContext: vi.fn(async () => {
        throw new Error('discord down')
      }),
    })
    const error: any = await createDraftHandler(deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(502)
    expect(deps.completeText).not.toHaveBeenCalled()
  })

  it('returns 403 with the reason when the guild has no usable AI key', async () => {
    const { deps } = makeDeps({ resolveGuildAi: vi.fn(async () => ({ ok: false as const, reason: 'not_premium' as const })) })
    const error: any = await createDraftHandler(deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(403)
    expect(error.data).toEqual({ reason: 'not_premium' })
    expect(deps.completeText).not.toHaveBeenCalled()
  })

  it('checks module access before resolving AI or calling the provider', async () => {
    const denied = Object.assign(new Error('nope'), { statusCode: 403 })
    const { deps } = makeDeps({ requireModuleAccess: vi.fn(async () => { throw denied }) })
    await expect(createDraftHandler(deps)(event)).rejects.toBe(denied)
    expect(deps.resolveGuildAi).not.toHaveBeenCalled()
    expect(deps.completeText).not.toHaveBeenCalled()
  })

  it.each([
    ['missing guild_id', { prompt: 'x' }],
    ['missing prompt', { guild_id: 'g1' }],
    ['whitespace-only prompt', { guild_id: 'g1', prompt: '   ' }],
    ['non-string prompt', { guild_id: 'g1', prompt: 42 }],
    ['prompt over 500 characters', { guild_id: 'g1', prompt: 'x'.repeat(501) }],
    ['no body', null],
  ])('returns 400 for %s', async (_label, body) => {
    const { deps } = makeDeps({ readBody: async () => body })
    const error: any = await createDraftHandler(deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(400)
    expect(deps.requireModuleAccess).not.toHaveBeenCalled()
  })

  it('accepts a prompt of exactly 500 characters', async () => {
    const { deps } = makeDeps({ readBody: async () => ({ guild_id: 'g1', prompt: 'x'.repeat(500) }) })
    await expect(createDraftHandler(deps)(event)).resolves.toBeDefined()
  })

  it('returns 503 when the database is unavailable', async () => {
    const { deps } = makeDeps({ getRepos: () => null })
    const error: any = await createDraftHandler(deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(503)
  })

  it('rate-limits the same user and guild for 10 seconds, but not other users or later calls', async () => {
    const { deps, clock } = makeDeps()
    const handler = createDraftHandler(deps)
    await handler(event)
    clock.t += 1000
    const blocked: any = await handler(event).catch((e) => e)
    expect(blocked.statusCode).toBe(429)
    expect(deps.completeText).toHaveBeenCalledTimes(1)

    ;(deps.requireModuleAccess as any).mockResolvedValueOnce({ userId: 'u2' })
    await expect(handler(event)).resolves.toBeDefined()

    clock.t += DRAFT_COOLDOWN_MS
    await expect(handler(event)).resolves.toBeDefined()
  })

  it('lets only one of two simultaneous requests reach the provider', async () => {
    const { deps } = makeDeps({
      resolveGuildAi: vi.fn(async () => {
        await Promise.resolve()
        await Promise.resolve()
        return okAi
      }),
    })
    const handler = createDraftHandler(deps)
    const results = await Promise.allSettled([handler(event), handler(event)])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect((rejected.reason as any).statusCode).toBe(429)
    expect(deps.completeText).toHaveBeenCalledTimes(1)
  })

  it('does not start the cooldown when the guild has no usable AI key', async () => {
    const { deps } = makeDeps({
      resolveGuildAi: vi.fn(async () => ({ ok: false as const, reason: 'not_premium' as const })),
    })
    const handler = createDraftHandler(deps)
    const first: any = await handler(event).catch((e) => e)
    const second: any = await handler(event).catch((e) => e)
    expect(first.statusCode).toBe(403)
    expect(second.statusCode).toBe(403)
  })

  it('still cools down after a failed provider call, so a broken key cannot be hammered', async () => {
    const { deps } = makeDeps({ completeText: vi.fn(async () => { throw new Error('boom') }) })
    const handler = createDraftHandler(deps)
    await handler(event).catch(() => undefined)
    const second: any = await handler(event).catch((e) => e)
    expect(second.statusCode).toBe(429)
  })

  it('does not fail the request when usage logging fails', async () => {
    const { deps } = makeDeps({
      getRepos: () => ({ aiUsage: { log: vi.fn(async () => { throw new Error('db down') }) } }) as any,
    })
    await expect(createDraftHandler(deps)(event)).resolves.toBeDefined()
    expect(deps.logError).toHaveBeenCalled()
  })
})

describe('createDraftStatusHandler', () => {
  it('reports availability and the key source without exposing the key', async () => {
    const { deps } = makeDeps()
    const result = await createDraftStatusHandler(deps)(event)
    expect(result).toEqual({ available: true, source: 'shared' })
    expect(JSON.stringify(result)).not.toContain('secret-key')
  })

  it('reports the reason when unavailable', async () => {
    const { deps } = makeDeps({ resolveGuildAi: vi.fn(async () => ({ ok: false as const, reason: 'no_shared_key' as const })) })
    await expect(createDraftStatusHandler(deps)(event)).resolves.toEqual({
      available: false,
      source: null,
      reason: 'no_shared_key',
    })
  })

  it('requires guild_id and module access', async () => {
    const missing = makeDeps({ getQuery: () => ({}) })
    const error: any = await createDraftStatusHandler(missing.deps)(event).catch((e) => e)
    expect(error.statusCode).toBe(400)

    const denied = Object.assign(new Error('nope'), { statusCode: 403 })
    const { deps } = makeDeps({ requireModuleAccess: vi.fn(async () => { throw denied }) })
    await expect(createDraftStatusHandler(deps)(event)).rejects.toBe(denied)
    expect(deps.resolveGuildAi).not.toHaveBeenCalled()
  })
})
