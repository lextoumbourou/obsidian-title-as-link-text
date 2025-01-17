import { TFile, CachedMetadata, HeadingCache } from 'obsidian';
import { LinkUpdater, VaultLike, MetadataCacheLike } from './main';

// Add basename function
function basename(path: string): string {
  let base = new String(path).substring(path.lastIndexOf("/") + 1);
  return base;
}

// Mock implementation of VaultLike
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

// Mock implementation of MetadataCacheLike
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

  on() { } // No-op for testing
}

describe('LinkUpdater', () => {
  let vault: MockVault;
  let metadataCache: MockMetadataCache;
  let linkUpdater: LinkUpdater;

  beforeEach(() => {

  });

  it('should update link text based on frontmatter title', async () => {
    vault = new MockVault({
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    });

    metadataCache = new MockMetadataCache({
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
    });

    linkUpdater = new LinkUpdater(vault, metadataCache);

    const sourceFile = {
      path: 'note1.md',
      name: 'note1.md'
    } as TFile;

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);

    const updatedContent = await vault.read(sourceFile);
    expect(updatedContent).toBe('Here is a [Front Matter Title](note2.md)');
  });

  it('should update link text based on heading title', async () => {
    vault = new MockVault({
      'note1.md': 'Here is a [link](note2.md)',
      'note2.md': 'Content of note 2'
    });

    metadataCache = new MockMetadataCache({
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
    });

    linkUpdater = new LinkUpdater(vault, metadataCache);

    const sourceFile = {
      path: 'note1.md',
      name: 'note1.md'
    } as TFile;

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);

    const updatedContent = await vault.read(sourceFile);
    expect(updatedContent).toBe('Here is a [Heading Title](note2.md)');
  });
});
