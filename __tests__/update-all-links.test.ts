import { CachedMetadata, HeadingCache, LinkCache } from 'obsidian';
import { setupTest } from './test-utils';

describe('LinkUpdater - updateAllLinks', () => {
  it('should update every link in the vault, reading each note only once', async () => {
    const files = {
      'note1.md': 'See [link](note2.md)',
      'note2.md': '# Note Two Title\n[[note3]]',
      'note3.md': '# Note Three Title'
    };
    const { linkUpdater, vault } = setupTest(files, {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }] as LinkCache[],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        links: [{ link: 'note3', original: '[[note3]]' }] as LinkCache[],
        headings: [{ heading: 'Note Two Title' }] as HeadingCache[],
        frontmatter: undefined
      } as CachedMetadata,
      'note3.md': {
        links: [],
        headings: [{ heading: 'Note Three Title' }] as HeadingCache[],
        frontmatter: undefined
      } as CachedMetadata
    });

    const updatedCount = await linkUpdater.updateAllLinks();

    expect(updatedCount).toBe(2);
    expect(files['note1.md']).toBe('See [Note Two Title](note2.md)');
    expect(files['note2.md']).toBe('# Note Two Title\n[[note3|Note Three Title]]');
    expect(files['note3.md']).toBe('# Note Three Title');

    // O(N): each note is processed exactly once, with no backlink rescans.
    expect(vault.read).toHaveBeenCalledTimes(3);
  });
});
