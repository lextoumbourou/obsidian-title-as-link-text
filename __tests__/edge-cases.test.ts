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
}); 