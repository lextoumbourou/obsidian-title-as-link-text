import { createSourceFile } from './test-utils';
import { CachedMetadata, HeadingCache, Vault, MetadataCache } from 'obsidian';
import { LinkUpdater } from '../main';

describe('LinkUpdater - Title source settings', () => {
  it('should ignore frontmatter title when useFrontmatterTitle is false', async () => {
    const vault = new (jest.requireMock('obsidian').Vault)() as jest.Mocked<Vault>;
    const metadataCache = new (jest.requireMock('obsidian').MetadataCache)() as jest.Mocked<MetadataCache>;

    const files: Record<string, string> = {
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    };

    vault.read.mockImplementation((file) => Promise.resolve(files[file.path] || ''));
    vault.modify.mockImplementation((file, content) => {
      files[file.path] = content;
      return Promise.resolve();
    });

    const metadata: Record<string, CachedMetadata> = {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: { title: 'Frontmatter Title' },
        headings: [{ heading: 'Heading Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    };

    metadataCache.getFileCache.mockImplementation((file) => metadata[file.path] || null);
    metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => {
      if (metadata[linkpath]) return createSourceFile(linkpath);
      return null;
    });

    const linkUpdater = new LinkUpdater(vault, metadataCache, {
      debounceDelay: 1000,
      similarityThreshold: 0.65,
      useFrontmatterTitle: false,
      frontmatterTitleProperty: 'title',
      useFirstHeading: true,
      autoUpdate: true
    });

    const sourceFile = createSourceFile('note1.md');
    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    expect(files['note1.md']).toBe('Here is a [Heading Title](note2.md)');
  });

  it('should ignore first heading when useFirstHeading is false', async () => {
    const vault = new (jest.requireMock('obsidian').Vault)() as jest.Mocked<Vault>;
    const metadataCache = new (jest.requireMock('obsidian').MetadataCache)() as jest.Mocked<MetadataCache>;

    const files: Record<string, string> = {
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    };

    vault.read.mockImplementation((file) => Promise.resolve(files[file.path] || ''));
    vault.modify.mockImplementation((file, content) => {
      files[file.path] = content;
      return Promise.resolve();
    });

    const metadata: Record<string, CachedMetadata> = {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: undefined,
        headings: [{ heading: 'Heading Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    };

    metadataCache.getFileCache.mockImplementation((file) => metadata[file.path] || null);
    metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => {
      if (metadata[linkpath]) return createSourceFile(linkpath);
      return null;
    });

    const linkUpdater = new LinkUpdater(vault, metadataCache, {
      debounceDelay: 1000,
      similarityThreshold: 0.65,
      useFrontmatterTitle: true,
      frontmatterTitleProperty: 'title',
      useFirstHeading: false,
      autoUpdate: true
    });

    const sourceFile = createSourceFile('note1.md');
    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    expect(files['note1.md']).toBe('Here is a [note2](note2.md)');
  });

  it('should use filename when both title sources are disabled', async () => {
    const vault = new (jest.requireMock('obsidian').Vault)() as jest.Mocked<Vault>;
    const metadataCache = new (jest.requireMock('obsidian').MetadataCache)() as jest.Mocked<MetadataCache>;

    const files: Record<string, string> = {
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    };

    vault.read.mockImplementation((file) => Promise.resolve(files[file.path] || ''));
    vault.modify.mockImplementation((file, content) => {
      files[file.path] = content;
      return Promise.resolve();
    });

    const metadata: Record<string, CachedMetadata> = {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: { title: 'Frontmatter Title' },
        headings: [{ heading: 'Heading Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    };

    metadataCache.getFileCache.mockImplementation((file) => metadata[file.path] || null);
    metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => {
      if (metadata[linkpath]) return createSourceFile(linkpath);
      return null;
    });

    const linkUpdater = new LinkUpdater(vault, metadataCache, {
      debounceDelay: 1000,
      similarityThreshold: 0.65,
      useFrontmatterTitle: false,
      frontmatterTitleProperty: 'title',
      useFirstHeading: false,
      autoUpdate: true
    });

    const sourceFile = createSourceFile('note1.md');
    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    expect(files['note1.md']).toBe('Here is a [note2](note2.md)');
  });

  it('should use custom frontmatter property for title', async () => {
    const vault = new (jest.requireMock('obsidian').Vault)() as jest.Mocked<Vault>;
    const metadataCache = new (jest.requireMock('obsidian').MetadataCache)() as jest.Mocked<MetadataCache>;

    const files: Record<string, string> = {
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    };

    vault.read.mockImplementation((file) => Promise.resolve(files[file.path] || ''));
    vault.modify.mockImplementation((file, content) => {
      files[file.path] = content;
      return Promise.resolve();
    });

    const metadata: Record<string, CachedMetadata> = {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: {
          title: 'Default Title',
          customTitle: 'Custom Property Title'
        },
        headings: [{ heading: 'Heading Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    };

    metadataCache.getFileCache.mockImplementation((file) => metadata[file.path] || null);
    metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => {
      if (metadata[linkpath]) return createSourceFile(linkpath);
      return null;
    });

    const linkUpdater = new LinkUpdater(vault, metadataCache, {
      debounceDelay: 1000,
      similarityThreshold: 0.65,
      useFrontmatterTitle: true,
      frontmatterTitleProperty: 'customTitle',
      useFirstHeading: true,
      autoUpdate: true
    });

    const sourceFile = createSourceFile('note1.md');
    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    expect(files['note1.md']).toBe('Here is a [Custom Property Title](note2.md)');
  });

  it('should fall back to first heading when custom frontmatter property does not exist', async () => {
    const vault = new (jest.requireMock('obsidian').Vault)() as jest.Mocked<Vault>;
    const metadataCache = new (jest.requireMock('obsidian').MetadataCache)() as jest.Mocked<MetadataCache>;

    const files: Record<string, string> = {
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    };

    vault.read.mockImplementation((file) => Promise.resolve(files[file.path] || ''));
    vault.modify.mockImplementation((file, content) => {
      files[file.path] = content;
      return Promise.resolve();
    });

    const metadata: Record<string, CachedMetadata> = {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: {
          title: 'Default Title'
        },
        headings: [{ heading: 'Heading Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    };

    metadataCache.getFileCache.mockImplementation((file) => metadata[file.path] || null);
    metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => {
      if (metadata[linkpath]) return createSourceFile(linkpath);
      return null;
    });

    const linkUpdater = new LinkUpdater(vault, metadataCache, {
      debounceDelay: 1000,
      similarityThreshold: 0.65,
      useFrontmatterTitle: true,
      frontmatterTitleProperty: 'customTitle',
      useFirstHeading: true,
      autoUpdate: true
    });

    const sourceFile = createSourceFile('note1.md');
    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    expect(files['note1.md']).toBe('Here is a [Heading Title](note2.md)');
  });
});
