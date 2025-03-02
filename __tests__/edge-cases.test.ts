import { CachedMetadata } from 'obsidian';
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

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('[[  \n\n[Doggos](dogs.md)');
  });
}); 