import { describe, expect, it } from 'vitest'
import { renderDiscordMarkdown } from './discord-markdown'
import {
  DEFAULT_WELCOME_MESSAGE,
  normalizeWelcomeMessage,
  welcomeMessageText,
  type WelcomePreviewVars,
} from './welcome-message'

const vars: WelcomePreviewVars = {
  userId: '42',
  username: 'newbie',
  displayName: 'New Person',
  serverName: 'Cool Server',
  memberCount: 123,
}

describe('normalizeWelcomeMessage', () => {
  it('fills in defaults for templates saved before message settings existed', () => {
    expect(normalizeWelcomeMessage(undefined)).toEqual(DEFAULT_WELCOME_MESSAGE)
  })

  it('keeps saved values and defaults the missing ones', () => {
    expect(normalizeWelcomeMessage({ mode: 'text', title: 'Hi' })).toEqual({
      ...DEFAULT_WELCOME_MESSAGE,
      mode: 'text',
      title: 'Hi',
    })
  })

  it('returns a fresh object each time', () => {
    const a = normalizeWelcomeMessage(undefined)
    a.body = 'changed'
    expect(DEFAULT_WELCOME_MESSAGE.body).not.toBe('changed')
  })
})

describe('welcomeMessageText', () => {
  it('prefixes the title as a heading and fills placeholders', () => {
    const message = {
      ...DEFAULT_WELCOME_MESSAGE,
      title: 'Hey {displayname}',
      body: '{user} is #{member_count} in {server_name} ({username})',
    }
    expect(welcomeMessageText(message, vars)).toBe(
      '# Hey New Person\n<@42> is #123 in Cool Server (newbie)',
    )
  })

  it('is empty in image-only mode', () => {
    expect(welcomeMessageText({ ...DEFAULT_WELCOME_MESSAGE, mode: 'image' }, vars)).toBe('')
  })

  it('is empty when both title and body are blank', () => {
    expect(
      welcomeMessageText({ ...DEFAULT_WELCOME_MESSAGE, title: ' ', body: '  ' }, vars),
    ).toBe('')
  })
})

describe('renderDiscordMarkdown user mentions', () => {
  it('shows the known user name instead of a generic mention', () => {
    const html = renderDiscordMarkdown('<@42>', { users: [{ id: '42', name: 'New Person' }] })
    expect(html).toContain('@New Person')
  })

  it('falls back to @user for unknown ids', () => {
    expect(renderDiscordMarkdown('<@7>')).toContain('@user')
  })
})
