import type { ServiceDefinition } from './types';

export const PRESET_SERVICES: ServiceDefinition[] = [
  // Communication
  {
    id: 'slack',
    name: 'Slack',
    url: 'https://app.slack.com/',
    icon: 'slack',
    isPreset: true,
    category: 'communication',
    relatedDomains: ['slack.com'],
  },
  {
    id: 'chatwork',
    name: 'Chatwork',
    url: 'https://www.chatwork.com/',
    icon: 'chatwork',
    isPreset: true,
    category: 'communication',
  },
  {
    id: 'messenger',
    name: 'Facebook Messenger',
    url: 'https://www.messenger.com/',
    icon: 'messenger',
    isPreset: true,
    category: 'communication',
    relatedDomains: ['facebook.com', 'fbcdn.net'],
  },
  {
    id: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    icon: 'discord',
    isPreset: true,
    category: 'communication',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    url: 'https://teams.microsoft.com/',
    icon: 'teams',
    isPreset: true,
    category: 'communication',
    relatedDomains: ['microsoft.com', 'microsoftonline.com', 'live.com'],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://web.telegram.org/',
    icon: 'telegram',
    isPreset: true,
    category: 'communication',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com/',
    icon: 'whatsapp',
    isPreset: true,
    category: 'communication',
  },

  // SNS
  {
    id: 'x',
    name: 'X (Twitter)',
    url: 'https://x.com/',
    icon: 'x',
    isPreset: true,
    category: 'sns',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com/',
    icon: 'instagram',
    isPreset: true,
    category: 'sns',
    relatedDomains: ['facebook.com'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/',
    icon: 'facebook',
    isPreset: true,
    category: 'sns',
    relatedDomains: ['messenger.com', 'fbcdn.net'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/',
    icon: 'linkedin',
    isPreset: true,
    category: 'sns',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    url: 'https://www.reddit.com/',
    icon: 'reddit',
    isPreset: true,
    category: 'sns',
  },
  {
    id: 'threads',
    name: 'Threads',
    url: 'https://www.threads.net/',
    icon: 'threads',
    isPreset: true,
    category: 'sns',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    url: 'https://www.tiktok.com/',
    icon: 'tiktok',
    isPreset: true,
    category: 'sns',
  },

  // Productivity
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com/',
    icon: 'gmail',
    isPreset: true,
    category: 'productivity',
    relatedDomains: ['google.com', 'googleapis.com', 'gstatic.com'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    url: 'https://drive.google.com/',
    icon: 'google-drive',
    isPreset: true,
    category: 'productivity',
    relatedDomains: ['google.com', 'googleapis.com', 'gstatic.com'],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    url: 'https://calendar.google.com/',
    icon: 'google-calendar',
    isPreset: true,
    category: 'productivity',
    relatedDomains: ['google.com', 'googleapis.com', 'gstatic.com'],
  },
  {
    id: 'notion',
    name: 'Notion',
    url: 'https://www.notion.so/',
    icon: 'notion',
    isPreset: true,
    category: 'productivity',
  },

  // Development
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/',
    icon: 'github',
    isPreset: true,
    category: 'development',
  },

  // Business
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://dashboard.stripe.com/',
    icon: 'stripe',
    isPreset: true,
    category: 'business',
    relatedDomains: ['stripe.com'],
  },
];

export const SERVICE_CATEGORIES: Record<string, string> = {
  communication: 'Communication',
  sns: 'SNS',
  productivity: 'Productivity',
  development: 'Development',
  business: 'Business',
};

export const ACCOUNT_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#6B7280', // gray
];

export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;
export const SIDEBAR_WIDTH_COLLAPSED = 56;
export const SIDEBAR_WIDTH_EXPANDED = 200;
