import { CachedMetadata, HeadingCache } from 'obsidian';
import { setupTest } from './test-utils';

describe('LinkUpdater - Markdown links', () => {
  it('should update link text based on frontmatter title', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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
    const { linkUpdater, sourceFile, vault } = setupTest(
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

  it('ignores links to headers in the same note', async () => {
    const note1 = {
      links: [{
        link: '#heading-2',
        original: '[Heading 2](#heading-2)'
      }],
      frontmatter: undefined,
      headings: [{heading: 'Heading 1', level: 1} as HeadingCache, {heading: 'Heading 2', level: 2} as HeadingCache],
    };
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': '# Heading 1\n\nLink: [Heading 2](#heading-2)\n\n## Heading 2'
      },
      {
        'note1.md': note1 as CachedMetadata,
        '': note1 as CachedMetadata,
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('# Heading 1\n\nLink: [Heading 2](#heading-2)\n\n## Heading 2');
  });

  it('should not update alt text in image links', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is an image: ![Custom Alt Text](cool-img.jpg)'
      },
      {
        'note1.md': {
          links: [{
            link: 'cool-img.jpg',
            original: '![Custom Alt Text](cool-img.jpg)',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'cool-img.jpg': {
          frontmatter: undefined,
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is an image: ![Custom Alt Text](cool-img.jpg)');
  });
}); 