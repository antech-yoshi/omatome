export interface ServiceDefinition {
  id: string;
  name: string;
  url: string;
  icon: string;
  isPreset: boolean;
  category?: string;
  relatedDomains?: string[]; // domains used for auth/login that should stay in-webview
}

export interface Account {
  id: string;
  serviceId: string;
  label: string;
  order: number;
  partitionKey: string;
  groupId?: string;
  customUrl?: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface EphemeralTab {
  id: string;
  url: string;
  title: string;
  partitionKey: string;  // same as parent account to share session
  parentAccountId: string;
}

export type LinkOpenBehavior = 'in-app' | 'external-browser';
export type Appearance = 'light' | 'dark' | 'system';

export interface AppSettings {
  linkOpenBehavior: LinkOpenBehavior;
  appearance: Appearance;
}

export interface AppState {
  accounts: Account[];
  groups: Group[];
  activeAccountId: string | null;
  sidebarCollapsed: boolean;
  lastUrls?: Record<string, string>; // accountId -> last visited URL
}

export interface IpcChannels {
  'account:add': (account: Account) => void;
  'account:remove': (accountId: string) => void;
  'account:update': (account: Account) => void;
  'account:clear-session': (accountId: string) => void;
  'account:list': () => Account[];
  'app:get-state': () => AppState;
  'app:save-state': (state: Partial<AppState>) => void;
}
