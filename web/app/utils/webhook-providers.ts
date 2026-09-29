// Provider metadata shared by the Webhooks page and its embed editor.

export interface WebhookProvider {
  value: "webhook" | "github" | "twitch";
  label: string;
  icon: string;
  /** Classes for the small icon tile. */
  tileClass: string;
  description: string;
}

export const webhookProviders: WebhookProvider[] = [
  {
    value: "webhook",
    label: "Generic webhook",
    icon: "i-lucide-webhook",
    tileClass: "bg-sky-200/10 text-sky-200",
    description: "Any service that can POST JSON. The raw body is shown in the embed.",
  },
  {
    value: "github",
    label: "GitHub",
    icon: "i-simple-icons-github",
    tileClass: "bg-white/[0.08] text-gray-200",
    description: "PR merges, issues and pushes. Title, author and repo are parsed for you.",
  },
  {
    value: "twitch",
    label: "Twitch",
    icon: "i-simple-icons-twitch",
    tileClass: "bg-violet-400/10 text-violet-300",
    description: "Stream online and offline events, with streamer name, game and title.",
  },
];

export const webhookProvider = (value: string): WebhookProvider =>
  webhookProviders.find((p) => p.value === value) ?? webhookProviders[0]!;
