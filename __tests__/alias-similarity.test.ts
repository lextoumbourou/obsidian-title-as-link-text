import { CachedMetadata, HeadingCache } from 'obsidian';
import { setupTest } from './test-utils';

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
}); 