export interface SetupIssue {
  module: string;
  message: string;
  fixTo: string;
}

type Settings = Record<string, any>;
type Rule = (s: Settings) => string[];

const RULES: Record<string, Rule> = {
  welcome: (s) => (s.channelId ? [] : ["Welcome is on but has no channel selected"]),
  logging: (s) => (s.auditChannelId ? [] : ["Audit Logging is on but has no log channel"]),
  tickets: (s) => {
    const out: string[] = [];
    if (!s.panelChannelId) out.push("Tickets has no panel channel");
    const types: Array<{ parentChannelId?: string }> = Array.isArray(s.types) ? s.types : [];
    const hasParent = !!s.defaultParentChannelId || (types.length > 0 && types.every((t) => !!t.parentChannelId));
    if (!hasParent) out.push("Tickets has no channel to create ticket threads in");
    return out;
  },
  verification: (s) => {
    const out: string[] = [];
    if (!s.verificationChannelId) out.push("Verification has no verification channel");
    if (!Array.isArray(s.buttons) || s.buttons.length === 0) out.push("Verification has no verification buttons");
    return out;
  },
  moderation: (s) => {
    const out: string[] = [];
    if (!s.modLogChannelId) out.push("Moderation has no mod-log channel");
    if (s.botCanViewAuditLog === false) {
      out.push("Can't record Discord bans and kicks — the bot needs the View Audit Log permission");
    }
    return out;
  },
  alerts: (s) => (Array.isArray(s.alerts) && s.alerts.length > 0 ? [] : ["Social Alerts is on but has no alerts set up"]),
};

/** Enabled modules that are missing required settings. Pure; reads already-loaded config. */
export function setupIssues(input: {
  guildId: string;
  moduleNames: string[];
  isEnabled: (name: string) => boolean;
  getConfig: (name: string) => Settings;
}): SetupIssue[] {
  const issues: SetupIssue[] = [];
  for (const [module, rule] of Object.entries(RULES)) {
    if (!input.moduleNames.includes(module) || !input.isEnabled(module)) continue;
    for (const message of rule(input.getConfig(module) ?? {})) {
      issues.push({ module, message, fixTo: `/dashboard/server/${input.guildId}/modules/${module}` });
    }
  }
  return issues;
}
