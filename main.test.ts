import { TFile, CachedMetadata, HeadingCache } from 'obsidian';
import { LinkUpdater } from './main';
import { Vault, MetadataCache } from 'obsidian';

interface MockAppInterface {
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
    addText: jest.fn().mockReturnThis(),
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

describe('LinkUpdater', () => {
  let vault: jest.Mocked<Vault>;
  let metadataCache: jest.Mocked<MetadataCache>;
  let linkUpdater: LinkUpdater;
  let sourceFile: TFile;

  const defaultSettings = {
    debounceDelay: 1000,
    similarityThreshold: 0.65
  };

  const createSourceFile = (path = 'note1.md'): TFile => {
    const file = new TFile();
    file.path = path;
    file.name = path;
    if (!(file instanceof TFile)) {
      throw new Error('Failed to create TFile instance');
    }
    return file;
  };

  const setupTest = (
    files: { [path: string]: string },
    metadata: { [path: string]: CachedMetadata }
  ) => {
    vault = new Vault() as jest.Mocked<Vault>;
    metadataCache = new MetadataCache() as jest.Mocked<MetadataCache>;

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
      const normalizedLinkpath = linkpath.endsWith('.md') ? linkpath : `${linkpath}.md`;
      if (metadata[normalizedLinkpath]) {
        return createSourceFile(normalizedLinkpath);
      }
      return null;
    });

    linkUpdater = new LinkUpdater(vault, metadataCache, defaultSettings);
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
            headings: [{ heading: 'New Title' }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Front Matter Title' },
            headings: [{ heading: 'New Title' }] as HeadingCache[],
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
            headings: [{ heading: 'New Title' }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: undefined,
            headings: [{ heading: 'Heading Title' }] as HeadingCache[],
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
            headings: [{ heading: 'Different Title' }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [World](note2.md)');
    });

    it('should not modify checkbox markdown followed by a link', async () => {
      setupTest(
        {
          'note1.md': '[ ] [link](note2.md)\n[x] [another](note2.md)',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2.md',
              original: '[link](note2.md)',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Different Title' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toEqual(2);
      expect(await vault.read(sourceFile)).toBe('[ ] [Different Title](note2.md)\n[x] [Different Title](note2.md)');
    });

    it('should not modify checkbox markdown with spaces followed by a link', async () => {
      setupTest(
        {
          'note1.md': '  [ ]  [link](note2.md)',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2.md',
              original: '[link](note2.md)',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Different Title' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toEqual(1);
      expect(await vault.read(sourceFile)).toBe('  [ ]  [Different Title](note2.md)');
    });

    it('should handle mixed checkbox and regular markdown links correctly', async () => {
      setupTest(
        {
          'note1.md': '[ ] [task](note2.md)\nRegular [link](note2.md)',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2.md',
              original: '[task](note2.md)',
            }, {
              link: 'note2.md',
              original: '[link](note2.md)',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Different Title' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(2);
      expect(await vault.read(sourceFile)).toBe('[ ] [Different Title](note2.md)\nRegular [Different Title](note2.md)');
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
            headings: [{ heading: 'New Title' }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Front Matter Title' },
            headings: [{ heading: 'New Title' }] as HeadingCache[],
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
            headings: [{ heading: 'Different Title' }] as HeadingCache[],
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
            headings: [{ heading: 'New Title' }] as HeadingCache[],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Front Matter Title' },
            headings: [{ heading: 'New Title' }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2#Subheading|Front Matter Title]]');
    });

    it('should add display text to wikilink without alias when title differs', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2]]',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2',
              original: '[[note2]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Different Title' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2|Different Title]]');
    });

    it('should not add display text to wikilink when title matches filename', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2]]',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2',
              original: '[[note2]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'note2' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2]]');
    });

    it('should handle case-insensitive title matching', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[dogs]]',
          'dogs.md': 'Content about dogs'
        },
        {
          'note1.md': {
            links: [{
              link: 'dogs',
              original: '[[dogs]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'dogs.md': {
            frontmatter: { title: 'dogs' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [[dogs]]');
    });

    it('should add display text for nested path wikilinks when title differs', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[folder/note2]]',
          'folder/note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'folder/note2',
              original: '[[folder/note2]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'folder/note2.md': {
            frontmatter: { title: 'Different Title' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [[folder/note2|Different Title]]');
    });

    it('should handle wikilinks with subheadings but no display text', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[note2#Section]]',
          'note2.md': 'Content of note 2'
        },
        {
          'note1.md': {
            links: [{
              link: 'note2#Section',
              original: '[[note2#Section]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'note2.md': {
            frontmatter: { title: 'Different Title' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(1);
      expect(await vault.read(sourceFile)).toBe('Here is a [[note2#Section|Different Title]]');
    });

    it('should not add display text to wikilink when heading matches filename', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[dogs]]',
          'dogs.md': 'Content about dogs'
        },
        {
          'note1.md': {
            links: [{
              link: 'dogs',
              original: '[[dogs]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'dogs.md': {
            frontmatter: undefined,
            headings: [{ heading: 'dogs' }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [[dogs]]');
    });

    it('should not add display text to wikilink when there are no headings or title', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[dogs]]',
          'dogs.md': 'Content about dogs'
        },
        {
          'note1.md': {
            links: [{
              link: 'dogs',
              original: '[[dogs]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'dogs.md': {
            frontmatter: undefined,
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [[dogs]]');
    });

    it('should not update link text to alias when it matches the title exactly', async () => {
      setupTest(
        {
          'note1.md': 'Here is a [[dogs|Dogs]]',
          'dogs.md': 'Content about dogs'
        },
        {
          'note1.md': {
            links: [{
              link: 'dogs',
              original: '[[dogs|Dogs]]',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'dogs.md': {
            frontmatter: {
              title: 'Dogs',
              aliases: ['Doggos']
            },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toBe(0);
      expect(await vault.read(sourceFile)).toBe('Here is a [[dogs|Dogs]]');
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
            headings: [{ heading: 'Heading' }] as HeadingCache[]
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Note 2 Title',
              aliases: []  // Similar to "Hello"
            },
            headings: [{ heading: 'Heading' }] as HeadingCache[],
            links: []
          } as CachedMetadata,
          'note3.md': {
            frontmatter: {
              title: 'Another Title',
              aliases: ['Project Z']  // Similar to "Project X"
            },
            headings: [{ heading: 'Heading' }] as HeadingCache[],
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
            headings: [{ heading: 'Heading' }] as HeadingCache[]
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Note 2 Title',
              aliases: []  // Similar to "Hello"
            },
            headings: [{ heading: 'Heading' }] as HeadingCache[],
            links: []
          } as CachedMetadata,
          'note3.md': {
            frontmatter: {
              title: 'Another Title',
              aliases: ['Project Z']  // Similar to "Project X"
            },
            headings: [{ heading: 'Heading' }] as HeadingCache[],
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
            headings: [{ heading: 'Heading' }] as HeadingCache[]
          } as CachedMetadata,
          'note2.md': {
            frontmatter: {
              title: 'Note 2 Title',
              aliases: ['Hello 2']  // Contains "Hello"
            },
            headings: [{ heading: 'Heading' }] as HeadingCache[],
            links: []
          } as CachedMetadata,
          'note3.md': {
            frontmatter: {
              title: 'Another Title',
              aliases: ['My Project Name']  // Contains "Project"
            },
            headings: [{ heading: 'Heading' }] as HeadingCache[],
            links: []
          } as CachedMetadata
        }
      );

      const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
      expect(updatedCount).toEqual(2);
      expect(await vault.read(sourceFile)).toEqual('Here is a [Hello 2](note2.md) and another [My Project Name](note3.md)');
    });
  });

  describe('Edge cases', () => {
    it('should not modify markdown links when preceded by standalone double brackets', async () => {
      setupTest(
        {
          'note1.md': '[[  \n\n[Doggos](dogs.md)',
          'dogs.md': 'Content about dogs'
        },
        {
          'note1.md': {
            links: [{
              link: 'dogs.md',
              original: '[Doggos](dogs.md)',
            }],
            frontmatter: undefined
          } as CachedMetadata,
          'dogs.md': {
            frontmatter: { title: 'Doggos' },
            headings: [],
            links: []
          } as CachedMetadata
        }
      );

      expect(await vault.read(sourceFile)).toBe('[[  \n\n[Doggos](dogs.md)');
    });
  });
});
