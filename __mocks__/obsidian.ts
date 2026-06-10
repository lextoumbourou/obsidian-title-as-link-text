export class Plugin {
  app: unknown;

  registerEvent(): void { /* Mock implementation */ }
  addCommand(): void { /* Mock implementation */ }
  addSettingTab(): void { /* Mock implementation */ }
  loadData(): Promise<Record<string, unknown>> { return Promise.resolve({}); }
  saveData(): Promise<void> { return Promise.resolve(); }
}

export class PluginSettingTab {
  app: unknown;
  containerEl = { empty: (): void => { /* Mock implementation */ } };

  constructor(app: unknown, _plugin: unknown) {
    this.app = app;
  }
}

export class Setting {
  setName(): this { return this; }
  setDesc(): this { return this; }
  setHeading(): this { return this; }
  addText(): this { return this; }
  addToggle(): this { return this; }
  addButton(): this { return this; }
}

export class TFile {
  path: string;
  name: string;

  constructor(path: string, name: string) {
    this.path = path;
    this.name = name;
  }
}

export interface HeadingCache {
  heading: string;
  level: number;
  position: {
    start: { line: number; col: number; offset: number };
    end: { line: number; col: number; offset: number };
  };
}

export interface FrontMatterCache {
  title?: string;
  [key: string]: unknown;
}

export interface CachedMetadata {
  links?: Array<{
    link: string;
    original: string;
  }>;
  embeds?: Array<{
    link: string;
    original: string;
  }>;
  headings?: HeadingCache[];
  frontmatter?: FrontMatterCache;
}

export interface Debouncer<T extends unknown[], V> {
  (...args: [...T]): Debouncer<T, V>;
  cancel(): Debouncer<T, V>;
  run(): V | undefined;
}

// Timer-based debounce matching Obsidian's semantics: the last call's args
// win, and resetTimer restarts the wait on every call. Use jest fake timers
// to control it in tests.
export function debounce<T extends unknown[], V>(
  func: (...args: [...T]) => V,
  timeout = 0,
  resetTimer = false
): Debouncer<T, V> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: [...T] | null = null;

  const debounced = ((...args: [...T]) => {
    lastArgs = args;
    if (timer && resetTimer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs) {
          func(...lastArgs);
        }
      }, timeout);
    }
    return debounced;
  }) as Debouncer<T, V>;

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
    return debounced;
  };

  debounced.run = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      return func(...args);
    }
    return undefined;
  };

  return debounced;
}

export class Notice {
  constructor(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

export interface TAbstractFile {
  path: string;
}
