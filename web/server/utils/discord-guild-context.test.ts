import { describe, expect, it, vi } from 'vitest'
import { fetchGuildContext, GUILD_CONTEXT_LIMIT } from './discord-guild-context'

function fakeGet(roles: unknown, channels: unknown) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/roles')) return roles
    if (url.endsWith('/channels')) return channels
    throw new Error(`unexpected url ${url}`)
  })
}

describe('fetchGuildContext', () => {
  it('requests roles and channels with the bot token', async () => {
    const get = fakeGet([], [])
    await fetchGuildContext('12345', 'tok', get)
    expect(get).toHaveBeenCalledWith('https://discord.com/api/v10/guilds/12345/roles', { Authorization: 'Bot tok' })
    expect(get).toHaveBeenCalledWith('https://discord.com/api/v10/guilds/12345/channels', { Authorization: 'Bot tok' })
  })

  it('drops @everyone and managed roles and sorts by position, highest first', async () => {
    const get = fakeGet(
      [
        { id: '12345', name: '@everyone', position: 0, managed: false },
        { id: '1', name: 'Low', position: 1, managed: false },
        { id: '2', name: 'Bot role', position: 5, managed: true },
        { id: '3', name: 'High', position: 9, managed: false },
      ],
      [],
    )
    const ctx = await fetchGuildContext('12345', 'tok', get)
    expect(ctx.roles).toEqual([
      { id: '3', name: 'High' },
      { id: '1', name: 'Low' },
    ])
  })

  it('keeps only plain text channels, sorted by position (the bot cannot post to announcement channels)', async () => {
    const get = fakeGet(
      [],
      [
        { id: 'c3', name: 'voice', type: 2, position: 0 },
        { id: 'c2', name: 'news', type: 5, position: 2 },
        { id: 'c1', name: 'general', type: 0, position: 1 },
        { id: 'c5', name: 'rules', type: 0, position: 3 },
        { id: 'c4', name: 'category', type: 4, position: 0 },
      ],
    )
    const ctx = await fetchGuildContext('12345', 'tok', get)
    expect(ctx.channels).toEqual([
      { id: 'c1', name: 'general' },
      { id: 'c5', name: 'rules' },
    ])
  })

  it('caps each list at 100 entries', async () => {
    const roles = Array.from({ length: 150 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, position: i + 1, managed: false }))
    const channels = Array.from({ length: 150 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, type: 0, position: i }))
    const ctx = await fetchGuildContext('12345', 'tok', fakeGet(roles, channels))
    expect(ctx.roles).toHaveLength(GUILD_CONTEXT_LIMIT)
    expect(ctx.channels).toHaveLength(GUILD_CONTEXT_LIMIT)
  })

  it('treats non-array responses as empty', async () => {
    const ctx = await fetchGuildContext('12345', 'tok', fakeGet({ message: 'nope' }, null))
    expect(ctx).toEqual({ roles: [], channels: [] })
  })

  it('rejects a guild id that is not numeric so it cannot alter the request path', async () => {
    const get = fakeGet([], [])
    await expect(fetchGuildContext('123/../456', 'tok', get)).rejects.toThrow(/guild id/i)
    expect(get).not.toHaveBeenCalled()
  })
})
