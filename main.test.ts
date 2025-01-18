import { TFile, CachedMetadata, HeadingCache } from 'obsidian';
import { LinkUpdater, VaultLike, MetadataCacheLike } from './main';

class MockApp {
  vault: any;
  metadataCache: any;
  constructor() {
    this.vault = {};
    this.metadataCache = {};
  }
}

class MockPluginSettingTab {
  app: any;
  plugin: any;
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }
}

class MockPlugin {
  app: any;
  constructor() {
    this.app = new MockApp();
  }
  registerEvent() { }
  addCommand() { }
  addSettingTab() { }
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
}

// Mock the required Obsidian imports
jest.mock('obsidian', () => ({
  Plugin: class MockPlugin {
    app: any;
    constructor() {
      this.app = { vault: {}, metadataCache: {} };
    }
    registerEvent() { }
    addCommand() { }
    addSettingTab() { }
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  },
  PluginSettingTab: class MockPluginSettingTab {
    app: any;
    plugin: any;
    constructor(app: any, plugin: any) {
      this.app = app;
      this.plugin = plugin;
    }
  },
  Setting: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addText: jest.fn().mockReturnThis(),
  })),
  Notice: jest.fn(),
  debounce: (fn: any) => fn,
  TFile: class { },
}));

function basename(path: string): string {
  let base = new String(path).substring(path.lastIndexOf("/") + 1);
  return base;
}

// Mock implementation of Vault
class MockVault implements VaultLike {
  private files: Map<string, string> = new Map();

  constructor(initialFiles: { [path: string]: string }) {
    Object.entries(initialFiles).forEach(([path, content]) => {
      this.files.set(path, content);
    });
  }

  getMarkdownFiles(): TFile[] {
    return Array.from(this.files.keys()).map(path => ({
      path,
      name: basename(path),
    }) as TFile);
  }

  async read(file: TFile): Promise<string> {
    return this.files.get(file.path) || '';
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  on() { } // No-op for testing
}

// Mock implementation of MetadataCache
class MockMetadataCache implements MetadataCacheLike {
  constructor(private fileCache: { [path: string]: CachedMetadata }) { }

  getFileCache(file: TFile): CachedMetadata | null {
    return this.fileCache[file.path] || null;
  }

  getCache(path: string): CachedMetadata | null {
    return this.fileCache[path] || null;
  }

  getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null {
    const normalizedLinkpath = linkpath.endsWith('.md') ? linkpath : `${linkpath}.md`;
    if (this.fileCache[normalizedLinkpath]) {
      const result = {
        path: normalizedLinkpath,
        name: basename(normalizedLinkpath)
      } as TFile;
      return result;
    }
    return null;
  }

  on() { }
}

describe('LinkUpdater', () => {
  let vault: MockVault;
  let metadataCache: MockMetadataCache;
  let linkUpdater: LinkUpdater;
  let sourceFile: TFile;

  const createSourceFile = (path: string = 'note1.md'): TFile => ({
    path,
    name: path
  } as TFile);

  const setupTest = (
    files: { [path: string]: string },
    metadata: { [path: string]: CachedMetadata }
  ) => {
    vault = new MockVault(files);
    metadataCache = new MockMetadataCache(metadata);
    linkUpdater = new LinkUpdater(vault, metadataCache);
    sourceFile = createSourceFile();
  };

  describe('Markdown links', () => {
    it('should update link text based on frontmatter title', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [link](note2.md)',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2.md',
              original: '[link](note2.md)',
            }],
            headings: [{ heading: "New Title" }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Front Matter Title' },
            headings: [{ heading: "New Title" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [Front Matter Title](note2.md)');
    });

    it('should update link text based on heading title', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [link](note2.md)',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2.md',
              original: '[link](note2.md)',
            }],
            headings: [{ heading: "New Title" }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: undefined,
            headings: [{ heading: "Heading Title" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [Heading Title](note2.md)');
    });

    it('should not update link text if it matches an alias', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [World](note2.md)',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2.md',
              original: '[World](note2.md)',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Dogs 1',
              aliases: ['Hello', 'World']
            },
            headings: [{ heading: "Different Title" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [World](note2.md)');
    });
  });

  describe('Wiki links', () => {
    it('should update wikilink text based on frontmatter title', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2|link]]',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2',
              original: '[[note2|link]]',
            }],
            headings: [{ heading: "New Title" }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Front Matter Title' },
            headings: [{ heading: "New Title" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2|Front Matter Title]]');
    });

    it('should not update wikilink text if it matches an alias', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2|World]]',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2',
              original: '[[note2|World]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Dogs 1',
              aliases: ['Hello', 'World']
            },
            headings: [{ heading: "Different Title" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2|World]]');
    });

    it('should update wikilink text with subheading based on frontmatter title', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2#Subheading|link]]',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2#Subheading',
              original: '[[note2#Subheading|link]]',
            }],
            headings: [{ heading: "New Title" }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Front Matter Title' },
            headings: [{ heading: "New Title" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2#Subheading|Front Matter Title]]');
    });
  });

  describe('Alias similarity', () => {
    it('should update link text if it matches a similar alias', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [note2](note2.md) and another [Project X](note3.md)',
          'note2.md': 'Content of note 2',
          'note3.md': 'Content of note 3'
        },
        {
          'note1.md': {
            links: [
              {
                link: 'note2.md',
                original: '[Hello](note2.md)',
              },
              {
                link: 'note3.md',
                original: '[Project X](note3.md)',
              }
            ],
            frontmatter: undefined,
            headings: [{ heading: "Heading" }] as HeadingCache[]
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Note 2 Title',
              aliases: []  // Similar to "Hello"
            },
            headings: [{ heading: "Heading" }] as HeadingCache[],
            links: []
          } as CachedMetadata,
          'note3.md': {
            frontmatter: {
              title: 'Another Title',
              aliases: ['Project Z']  // Similar to "Project X"
            },
            headings: [{ heading: "Heading" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toEqual(2);
      expect(await vault.read(sourceFile)).toEqual('Here is a [Note 2 Title](note2.md) and another [Project Z](note3.md)');
    });

    it('should update wikilink text if it matches a similar alias', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2|Hello]] and another [[note3|Project X]]',
          'note2.md': 'Content of note 2',
          'note3.md': 'Content of note 3'
        },
        {
          'note1.md': {
            links: [
              {
                link: 'note2',
                original: '[[note2|Hello]]',
              },
              {
                link: 'note3',
                original: '[[note3|Project X]]',
              }
            ],
            frontmatter: undefined,
            headings: [{ heading: "Heading" }] as HeadingCache[]
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Note 2 Title',
              aliases: []  // Similar to "Hello"
            },
            headings: [{ heading: "Heading" }] as HeadingCache[],
            links: []
          } as CachedMetadata,
          'note3.md': {
            frontmatter: {
              title: 'Another Title',
              aliases: ['Project Z']  // Similar to "Project X"
            },
            headings: [{ heading: "Heading" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toEqual(2);
      expect(await vault.read(sourceFile)).toEqual('Here is a [[note2|Note 2 Title]] and another [[note3|Project Z]]');
    });

    it('should update link text if it matches a substring of an alias', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [Hello](note2.md) and another [Project](note3.md)',
          'note2.md': 'Content of note 2',
          'note3.md': 'Content of note 3'
        },
        {
          'note1.md': {
            links: [
              {
                link: 'note2.md',
                original: '[Hello](note2.md)',
              },
              {
                link: 'note3.md',
                original: '[Project](note3.md)',
              }
            ],
            frontmatter: undefined,
            headings: [{ heading: "Heading" }] as HeadingCache[]
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Note 2 Title',
              aliases: ['Hello 2']  // Contains "Hello"
            },
            headings: [{ heading: "Heading" }] as HeadingCache[],
            links: []
          } as CachedMetadata,
          'note3.md': {
            frontmatter: {
              title: 'Another Title',
              aliases: ['My Project Name']  // Contains "Project"
            },
            headings: [{ heading: "Heading" }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toEqual(2);
      expect(await vault.read(sourceFile)).toEqual('Here is a [Hello 2](note2.md) and another [My Project Name](note3.md)');
    });
  });
});
