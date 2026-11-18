import { describe, expect, it, vi } from 'vitest'
import type { BotFeedbackRow } from '@modus/db'
import {
  createFeedbackListHandler,
  createFeedbackStatusHandler,
  parseFeedbackQuery,
  parseFeedbackStatusBody,
  toFeedbackItemDto,
} from './admin-feedback'

const row: BotFeedbackRow = {
  id: 'fb-1',
  guildId: '111111111111111111',
  userId: '222222222222222222',
  category: 'bug',
  message: 'The bot ignores my command.',
  contactOk: true,
  context: { v: 1, guildName: 'Test', memberCount: 5, shardId: 0, botVersion: '1.0.0', locale: 'en-US' },
  status: 'open',
  resolvedAt: null,
  resolvedBy: null,
  createdAt: new Date('2026-11-18T10:00:00.000Z'),
}

const forbidden = Object.assign(new Error('Bot admin role required.'), { statusCode: 403 })
const unauthorized = Object.assign(new Error('Unauthorized'), { statusCode: 401 })

describe('parseFeedbackQuery', () => {
  it('returns only the default limit when no params are given', () => {
    expect(parseFeedbackQuery({})).toEqual({ limit: 50 })
  })

  it.each([['0'], ['101'], ['abc'], ['-1'], ['1.5']])('rejects limit=%s', (limit) => {
    expect(() => parseFeedbackQuery({ limit })).toThrow()
  })

  it.each([['1', 1], ['100', 100], ['25', 25]])('accepts limit=%s', (limit, expected) => {
    expect(parseFeedbackQuery({ limit })).toEqual({ limit: expected })
  })

  it.each([['open'], ['resolved']])('accepts status=%s', (status) => {
    expect(parseFeedbackQuery({ status })).toEqual({ status, limit: 50 })
  })

  it.each([['closed'], ['OPEN'], ['']])('rejects status=%j', (status) => {
    expect(() => parseFeedbackQuery({ status })).toThrow()
  })

  it('parses an ISO before date', () => {
    expect(parseFeedbackQuery({ before: '2026-11-18T10:00:00.000Z' })).toEqual({
      limit: 50,
      before: new Date('2026-11-18T10:00:00.000Z'),
    })
  })

  it.each([['yesterday'], ['']])('rejects before=%j', (before) => {
    expect(() => parseFeedbackQuery({ before })).toThrow()
  })
})

describe('parseFeedbackStatusBody', () => {
  it.each([['resolved'], ['open']] as const)('accepts %s', (status) => {
    expect(parseFeedbackStatusBody({ status })).toBe(status)
  })

  it.each([[null], [undefined], ['resolved'], [{}], [{ status: 'closed' }], [{ status: 1 }]])(
    'rejects %j',
    (body) => {
      expect(() => parseFeedbackStatusBody(body)).toThrow()
    },
  )
})

describe('toFeedbackItemDto', () => {
  it('serialises dates to ISO strings', () => {
    const dto = toFeedbackItemDto({
      ...row,
      status: 'resolved',
      resolvedAt: new Date('2026-11-18T11:00:00.000Z'),
      resolvedBy: '333',
    })
    expect(dto.createdAt).toBe('2026-11-18T10:00:00.000Z')
    expect(dto.resolvedAt).toBe('2026-11-18T11:00:00.000Z')
    expect(dto.resolvedBy).toBe('333')
  })

  it('keeps null resolved fields null', () => {
    const dto = toFeedbackItemDto(row)
    expect(dto.resolvedAt).toBeNull()
    expect(dto.resolvedBy).toBeNull()
  })

  it('maps every contract field and passes unknown context through', () => {
    const context = { v: 2, anything: true }
    expect(toFeedbackItemDto({ ...row, context })).toEqual({
      id: 'fb-1',
      guildId: row.guildId,
      userId: row.userId,
      category: 'bug',
      message: row.message,
      contactOk: true,
      context,
      status: 'open',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: '2026-11-18T10:00:00.000Z',
    })
  })
})

function listFixture(opts: { authError?: Error; repos?: boolean; list?: () => Promise<BotFeedbackRow[]> } = {}) {
  const list = vi.fn(opts.list ?? (async () => [row]))
  const authorize = vi.fn(async () => {
    if (opts.authError) throw opts.authError
    return { userId: 'admin-1' }
  })
  const getRepositories = vi.fn(() => (opts.repos === false ? null : { botFeedback: { list } }))
  const logError = vi.fn()
  const handler = createFeedbackListHandler<{ query: Record<string, unknown> }>({
    authorize,
    getQuery: (e) => e.query,
    getRepositories,
    logError,
  })
  return { handler, list, authorize, getRepositories, logError }
}

describe('createFeedbackListHandler', () => {
  it.each([[forbidden, 403], [unauthorized, 401]])('rejects before any repository call (%#)', async (err, code) => {
    const f = listFixture({ authError: err })
    await expect(f.handler({ query: {} })).rejects.toMatchObject({ statusCode: code })
    expect(f.getRepositories).not.toHaveBeenCalled()
    expect(f.list).not.toHaveBeenCalled()
  })

  it('returns 400 for a bad query and does not touch the repository', async () => {
    const f = listFixture()
    await expect(f.handler({ query: { limit: '0' } })).rejects.toMatchObject({ statusCode: 400 })
    expect(f.list).not.toHaveBeenCalled()
  })

  it('passes the parsed query to the repository and maps rows to DTOs', async () => {
    const f = listFixture()
    const result = await f.handler({ query: { status: 'open', limit: '10' } })
    expect(f.list).toHaveBeenCalledWith({ status: 'open', limit: 10 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: 'fb-1', createdAt: '2026-11-18T10:00:00.000Z' })
  })

  it('returns 503 when the database is not configured', async () => {
    const f = listFixture({ repos: false })
    await expect(f.handler({ query: {} })).rejects.toMatchObject({ statusCode: 503 })
  })

  it('logs and returns 500 when the repository fails', async () => {
    const boom = new Error('db down')
    const f = listFixture({ list: async () => { throw boom } })
    await expect(f.handler({ query: {} })).rejects.toMatchObject({ statusCode: 500 })
    expect(f.logError).toHaveBeenCalledWith(boom)
  })
})

interface PatchEvent { id?: string; body: unknown }

function patchFixture(opts: { authError?: Error; repos?: boolean; result?: BotFeedbackRow | null; fail?: Error } = {}) {
  const setStatus = vi.fn(async () => {
    if (opts.fail) throw opts.fail
    return opts.result === undefined ? { ...row, status: 'resolved' } : opts.result
  })
  const authorize = vi.fn(async () => {
    if (opts.authError) throw opts.authError
    return { userId: 'admin-1' }
  })
  const getRepositories = vi.fn(() => (opts.repos === false ? null : { botFeedback: { setStatus } }))
  const logError = vi.fn()
  const handler = createFeedbackStatusHandler<PatchEvent>({
    authorize,
    getId: (e) => e.id,
    readBody: async (e) => e.body,
    getRepositories,
    logError,
  })
  return { handler, setStatus, authorize, getRepositories, logError }
}

describe('createFeedbackStatusHandler', () => {
  it.each([[forbidden, 403], [unauthorized, 401]])('rejects before any repository call (%#)', async (err, code) => {
    const f = patchFixture({ authError: err })
    await expect(f.handler({ id: 'fb-1', body: { status: 'resolved' } })).rejects.toMatchObject({ statusCode: code })
    expect(f.getRepositories).not.toHaveBeenCalled()
    expect(f.setStatus).not.toHaveBeenCalled()
  })

  it('returns 400 for a bad body', async () => {
    const f = patchFixture()
    await expect(f.handler({ id: 'fb-1', body: { status: 'closed' } })).rejects.toMatchObject({ statusCode: 400 })
    expect(f.setStatus).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is missing', async () => {
    const f = patchFixture()
    await expect(f.handler({ body: { status: 'resolved' } })).rejects.toMatchObject({ statusCode: 400 })
    expect(f.setStatus).not.toHaveBeenCalled()
  })

  it('sets the status with the admin as actor and returns the DTO', async () => {
    const f = patchFixture()
    const dto = await f.handler({ id: 'fb-1', body: { status: 'resolved' } })
    expect(f.setStatus).toHaveBeenCalledWith('fb-1', 'resolved', 'admin-1')
    expect(dto).toMatchObject({ id: 'fb-1', status: 'resolved' })
  })

  it('returns 404 for an unknown id', async () => {
    const f = patchFixture({ result: null })
    await expect(f.handler({ id: 'nope', body: { status: 'open' } })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 503 when the database is not configured', async () => {
    const f = patchFixture({ repos: false })
    await expect(f.handler({ id: 'fb-1', body: { status: 'open' } })).rejects.toMatchObject({ statusCode: 503 })
  })

  it('logs and returns 500 when the repository fails', async () => {
    const boom = new Error('db down')
    const f = patchFixture({ fail: boom })
    await expect(f.handler({ id: 'fb-1', body: { status: 'open' } })).rejects.toMatchObject({ statusCode: 500 })
    expect(f.logError).toHaveBeenCalledWith(boom)
  })
})
