import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Account, Group, AppState, AppSettings } from '@shared/types';

interface StoreData {
  accounts: Account[];
  groups: Group[];
  appState: AppState;
  settings: AppSettings;
}

const DEFAULT_DATA: StoreData = {
  accounts: [],
  groups: [],
  appState: {
    accounts: [],
    groups: [],
    activeAccountId: null,
    sidebarCollapsed: false,
  },
  settings: {
    linkOpenBehavior: 'external-browser',
    appearance: 'system',
  },
};

class Store {
  private filePath: string;
  private data: StoreData;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'omatome-config.json');
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_DATA,
          ...parsed,
          settings: { ...DEFAULT_DATA.settings, ...parsed.settings },
        };
      }
    } catch {
      // ignore parse errors, use defaults
    }
    return { ...DEFAULT_DATA };
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  get<K extends keyof StoreData>(key: K): StoreData[K];
  get<K extends keyof StoreData>(key: K, defaultValue: StoreData[K]): StoreData[K];
  get<K extends keyof StoreData>(key: K, defaultValue?: StoreData[K]): StoreData[K] {
    const value = this.data[key];
    if (value === undefined && defaultValue !== undefined) {
      return defaultValue;
    }
    return value;
  }

  set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    this.data[key] = value;
    this.save();
  }
}

export function createStore(): Store {
  return new Store();
}

export type AppStore = Store;
