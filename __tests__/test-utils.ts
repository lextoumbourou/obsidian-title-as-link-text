import { TFile, CachedMetadata } from 'obsidian';
import { LinkUpdater } from '../main';
import { Vault, MetadataCache } from 'obsidian';

export interface MockAppInterface {
  vault: Vault;
  metadataCache: MetadataCache;
}

jest.mock('obsidian', () => ({
  Plugin: class MockPlugin {
    app: MockAppInterface;
    constructor() {
      this.app = {
        vault: {} as Vault,
        metadataCache: {} as MetadataCache
      };
    }
    registerEvent(): void { /* Mock implementation */ }
    addCommand(): void { /* Mock implementation */ }
    addSettingTab(): void { /* Mock implementation */ }
    loadData(): Promise<Record<string, unknown>> { return Promise.resolve({}); }
    saveData(): Promise<void> { return Promise.resolve(); }
  },
  PluginSettingTab: class MockPluginSettingTab {
    app: MockAppInterface;
    plugin: unknown;
    constructor(app: MockAppInterface, plugin: unknown) {
      this.app = app;
      this.plugin = plugin;
    }
  },
  Setting: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    setHeading: jest.fn().mockReturnThis(),
    addText: jest.fn().mockReturnThis(),
    addToggle: jest.fn().mockReturnThis(),
  })),
  Notice: jest.fn(),
  debounce: (fn: () => void) => fn,
  TFile: class { },
  Vault: jest.fn().mockImplementation(() => ({
    getMarkdownFiles: jest.fn(),
    read: jest.fn(),
    modify: jest.fn(),
    on: jest.fn(),
  })),
  MetadataCache: jest.fn().mockImplementation(() => ({
    getFileCache: jest.fn(),
    getCache: jest.fn(),
    getFirstLinkpathDest: jest.fn(),
    on: jest.fn(),
  })),
}));

export const defaultSettings = {
  debounceDelay: 1000,
  similarityThreshold: 0.65,
  useFrontmatterTitle: true,
  useFirstHeading: true
};

export const createSourceFile = (path = 'note1.md'): TFile => {
  const file = new TFile();
  file.path = path;
  file.name = path;
  if (!(file instanceof TFile)) {
    throw new Error('Failed to create TFile instance');
  }
  return file;
};

export const setupTest = (
  files: { [path: string]: string },
  metadata: { [path: string]: CachedMetadata }
): {
  vault: jest.Mocked<Vault>;
  metadataCache: jest.Mocked<MetadataCache>;
  linkUpdater: LinkUpdater;
  sourceFile: TFile;
} => {
  const vault = new Vault() as jest.Mocked<Vault>;
  const metadataCache = new MetadataCache() as jest.Mocked<MetadataCache>;

  vault.getMarkdownFiles.mockReturnValue(
    Object.keys(files).map(path => {
      const file = createSourceFile(path);
      return file;
    })
  );

  vault.read.mockImplementation((file: TFile) => {
    return Promise.resolve(files[file.path] || '');
  });

  vault.modify.mockImplementation((file: TFile, content: string) => {
    files[file.path] = content;
    return Promise.resolve();
  });

  metadataCache.getFileCache.mockImplementation((file: TFile) => {
    return metadata[file.path] || null;
  });

  metadataCache.getCache.mockImplementation((path: string) => {
    return metadata[path] || null;
  });

  metadataCache.getFirstLinkpathDest.mockImplementation((linkpath: string, _sourcePath: string) => {
    let normalizedLinkpath = linkpath;
    if (linkpath !== '' && !linkpath.includes('.') && !linkpath.endsWith('.md')) {
      normalizedLinkpath = `${linkpath}.md`;
    }

    if (metadata[normalizedLinkpath]) {
      return createSourceFile(normalizedLinkpath);
    }
    return null;
  });

  const linkUpdater = new LinkUpdater(vault, metadataCache, defaultSettings);
  const sourceFile = createSourceFile();

  return { vault, metadataCache, linkUpdater, sourceFile };
}; 