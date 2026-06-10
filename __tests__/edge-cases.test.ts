import { CachedMetadata, HeadingCache, LinkCache } from 'obsidian';
import { setupTest } from './test-utils';

describe('LinkUpdater - Edge cases', () => {
  it('should not modify markdown links when preceded by standalone double brackets', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': '[[  \n\n[Doggos](dogs.md)',
        'dogs.md': 'Content about dogs'
      },
      {
        'note1.md': {
          links: [{
            link: 'dogs.md',
            original: '[Doggos](dogs.md)',
          }] as LinkCache[],
          frontmatter: undefined
        } as CachedMetadata,
        'dogs.md': {
          frontmatter: { title: 'Doggos' },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('[[  \n\n[Doggos](dogs.md)');
  });

  it('should not corrupt content when unclosed [[ precedes a markdown link', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': '[[dogs are better than [cats](cats.md)',
        'cats.md': 'Content about cats'
      },
      {
        'note1.md': {
          links: [{
            link: 'cats.md',
            original: '[cats](cats.md)',
          }] as LinkCache[],
          frontmatter: undefined
        } as CachedMetadata,
        'cats.md': {
          frontmatter: { title: 'Cats' },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    await linkUpdater.updateLinksInNote(sourceFile);
    expect(await vault.read(sourceFile)).toBe('[[dogs are better than [Cats](cats.md)');
  });

  it('should strip links in headers', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': '[summary](summary.md)',
        'summary.md': '# Summary of [Doggos](dogs.md) and [[dogs|Doggos]]',
        'dogs.md': '# Doggos',
      },
      {
        'note1.md': {
          links: [{
            link: 'summary.md',
            original: '[summary](summary.md)',
          }] as LinkCache[],
          headings: [],
          frontmatter: undefined
        } as CachedMetadata,
        'summary.md': {
          links: [{
            link: 'dogs.md',
            original: '[Doggos](dogs.md)',
          },
          {
            link: 'dogs.md',
            original: '[dogs](dogs.md)',
          },
          {
            link: 'dogs.md',
            original: '[dogs|Doggos](dogs.md)',
          }
        ] as LinkCache[],
          headings: [{ heading: 'Summary of [Doggos](dogs.md) and [[dogs|Doggos]]' }] as HeadingCache[],
          frontmatter: undefined
        } as CachedMetadata,
        'dogs.md': {
          frontmatter: undefined,
          headings: [{ heading: 'Doggos' }] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe('[Summary of Doggos and Doggos](summary.md)');
  });

  it('should not crash on a literal percent sign in a link URL', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Check [discount](100%-deals.md)',
        '100%-deals.md': '# Deals'
      },
      {
        'note1.md': {
          links: [{
            link: '100%-deals.md',
            original: '[discount](100%-deals.md)',
          }] as LinkCache[],
          frontmatter: undefined
        } as CachedMetadata,
        '100%-deals.md': {
          frontmatter: undefined,
          headings: [{ heading: 'Deals' }] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe('Check [Deals](100%-deals.md)');
  });

  it('should preserve custom markdown link text when linked note has no explicit title', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'See [my custom description](other.md)',
        'other.md': 'no heading, no frontmatter'
      },
      {
        'note1.md': {
          links: [{
            link: 'other.md',
            original: '[my custom description](other.md)',
          }] as LinkCache[],
          frontmatter: undefined
        } as CachedMetadata,
        'other.md': {
          frontmatter: undefined,
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('See [my custom description](other.md)');
  });

  it('should coerce a non-string frontmatter title to a string', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': '[text](other.md)',
        'other.md': 'content'
      },
      {
        'note1.md': {
          links: [{
            link: 'other.md',
            original: '[text](other.md)',
          }] as LinkCache[],
          frontmatter: undefined
        } as CachedMetadata,
        'other.md': {
          frontmatter: { title: 2024 as unknown as string },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe('[2024](other.md)');
  });

  it('should not crash on non-string or null alias values', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': '[2025](other.md)',
        'other.md': 'content'
      },
      {
        'note1.md': {
          links: [{
            link: 'other.md',
            original: '[2025](other.md)',
          }] as LinkCache[],
          frontmatter: undefined
        } as CachedMetadata,
        'other.md': {
          frontmatter: { title: 'Other Note', aliases: [2024, null] as unknown as string[] },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe('[2024](other.md)');
  });
}); 