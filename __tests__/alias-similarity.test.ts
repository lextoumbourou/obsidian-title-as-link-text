import { CachedMetadata, HeadingCache, Vault, MetadataCache } from 'obsidian';
import { setupTest, createSourceFile } from './test-utils';
import { LinkUpdater } from '../main';

describe('LinkUpdater - Alias similarity', () => {
  it('should update link text if it matches a similar alias', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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

  it('ensure exact title matching wins over aliases', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'This is a [Thing](thing.md)',
        'thing.md': 'Content of note 2',
      },
      {
        'note1.md': {
          links: [
            {
              link: 'thing.md',
              original: '[Thing](thing.md)',
            },
          ],
          frontmatter: undefined,
          headings: [{ heading: 'Heading' }] as HeadingCache[]
        } as CachedMetadata,
        'thing.md': {
          frontmatter: {
            title: 'Thing',
            aliases: ['Things']
          },
          headings: [{ heading: 'Heading' }] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toEqual(0);
    expect(await vault.read(sourceFile)).toEqual('This is a [Thing](thing.md)');
  });

  it('ensure exact title matching wins over aliases - case insensitive', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'This is a [THING](thing.md)',
        'thing.md': 'Content of note 2',
      },
      {
        'note1.md': {
          links: [
            {
              link: 'thing.md',
              original: '[Thing](thing.md)',
            },
          ],
          frontmatter: undefined,
          headings: [{ heading: 'Heading' }] as HeadingCache[]
        } as CachedMetadata,
        'thing.md': {
          frontmatter: {
            title: 'Thing',
            aliases: ['Things']
          },
          headings: [{ heading: 'Heading' }] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toEqual(1);
    expect(await vault.read(sourceFile)).toEqual('This is a [Thing](thing.md)');
  });

  it('should not update link text when it exactly matches one of multiple aliases', async () => {
    // Bug: If a note has aliases ["Jessica", "Jess"] and a link uses "Jess",
    // the plugin incorrectly updates it to "Jessica" because the substring check
    // matches "Jessica" first (since "jessica".includes("jess") is true).
    // The expected behavior is to preserve "Jess" since it's an exact alias match.
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[person|Jess]]',
        'person.md': 'Content about Jessica'
      },
      {
        'note1.md': {
          links: [{
            link: 'person',
            original: '[[person|Jess]]',
          }],
          frontmatter: undefined,
          headings: [] as HeadingCache[]
        } as CachedMetadata,
        'person.md': {
          frontmatter: {
            title: 'Jessica Smith',
            aliases: ['Jessica', 'Jess']
          },
          headings: [] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    // Should NOT update because "Jess" is an exact match for one of the aliases
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[person|Jess]]');
  });

  it('should not update markdown link text when it exactly matches one of multiple aliases', async () => {
    // Same bug for markdown-style links
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [Jess](person.md)',
        'person.md': 'Content about Jessica'
      },
      {
        'note1.md': {
          links: [{
            link: 'person.md',
            original: '[Jess](person.md)',
          }],
          frontmatter: undefined,
          headings: [] as HeadingCache[]
        } as CachedMetadata,
        'person.md': {
          frontmatter: {
            title: 'Jessica Smith',
            aliases: ['Jessica', 'Jess']
          },
          headings: [] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    // Should NOT update because "Jess" is an exact match for one of the aliases
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [Jess](person.md)');
  });

  it('should ignore aliases when useAliases is disabled', async () => {
    const vault = new (jest.requireMock('obsidian').Vault)() as jest.Mocked<Vault>;
    const metadataCache = new (jest.requireMock('obsidian').MetadataCache)() as jest.Mocked<MetadataCache>;

    const files: Record<string, string> = {
      'note1.md': 'Here is a [Project](note2.md)',
      'note2.md': 'Content of note 2'
    };

    vault.read.mockImplementation((file) => Promise.resolve(files[file.path] || ''));
    vault.modify.mockImplementation((file, content) => {
      files[file.path] = content;
      return Promise.resolve();
    });

    const metadata: Record<string, CachedMetadata> = {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[Project](note2.md)' }],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: {
          title: 'Note Title',
          aliases: ['My Project Name']  // Would normally match "Project"
        },
        headings: [{ heading: 'Heading' }] as HeadingCache[],
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
      useFirstHeading: true,
      useAliases: false,
      autoUpdate: true
    });

    const sourceFile = createSourceFile('note1.md');
    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    // Should use title instead of matching alias
    expect(updatedCount).toBe(1);
    expect(files['note1.md']).toBe('Here is a [Note Title](note2.md)');
  });

}); 