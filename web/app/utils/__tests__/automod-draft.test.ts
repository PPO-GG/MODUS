import { describe, expect, it } from 'vitest'
import { draftToFormState, draftUnavailableMessage } from '../automod-draft'

const rule = {
  name: 'Link spam',
  trigger: 'message_create' as const,
  conditions: {
    operator: 'AND' as const,
    conditions: [
      { type: 'condition' as const, field: 'message.links_count', operator: 'greater_than', value: 2 },
    ],
  },
  actions: [
    { type: 'timeout_user', params: { duration: '2h' } },
    { type: 'ban_user' },
    { type: 'delete_message', delaySeconds: 5 },
  ],
  exempt_roles: ['111', '222'],
  exempt_channels: ['333'],
  cooldown: 30,
  priority: 2,
}

describe('draftToFormState', () => {
  it('maps a draft onto the editor form', () => {
    const form = draftToFormState(rule)
    expect(form).toMatchObject({
      name: 'Link spam',
      trigger: 'message_create',
      cooldown: 30,
      priority: 2,
      exemptRoles: ['111', '222'],
      exemptChannels: ['333'],
      exemptRolesInput: '111, 222',
      exemptChannelsInput: '333',
    })
    expect(form.conditions).toEqual(rule.conditions)
  })

  it('re-hydrates the timeout duration picker fields', () => {
    const [timeout] = draftToFormState(rule).actions
    expect(timeout).toEqual({
      type: 'timeout_user',
      params: { duration: '2h', _durationAmt: 2, _durationUnit: 'h' },
      delaySeconds: undefined,
    })
  })

  it('defaults ban delete_days to 0 and keeps delaySeconds', () => {
    const [, ban, del] = draftToFormState(rule).actions
    expect(ban).toEqual({ type: 'ban_user', params: { delete_days: 0 }, delaySeconds: undefined })
    expect(del).toEqual({ type: 'delete_message', params: {}, delaySeconds: 5 })
  })

  it('does not share arrays with the draft', () => {
    const form = draftToFormState(rule)
    form.exemptRoles.push('999')
    expect(rule.exempt_roles).toEqual(['111', '222'])
  })
})

describe('draftUnavailableMessage', () => {
  it.each([
    ['not_premium', /Premium or your own AI key/],
    ['no_shared_key', /contact the bot admin/],
    [undefined, /unavailable/i],
  ] as const)('explains %s', (reason, pattern) => {
    expect(draftUnavailableMessage(reason)).toMatch(pattern)
  })
})
