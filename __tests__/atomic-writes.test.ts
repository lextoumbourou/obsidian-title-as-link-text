import { CachedMetadata, HeadingCache, LinkCache, TFile } from 'obsidian';
import { setupTest } from './test-utils';

describe('LinkUpdater - Atomic writes', () => {
  it('should not clobber edits made while the update is in flight', async () => {
    const files: Record<string, string> = {
      'note1.md': 'See [link](note2.md)',
      'note2.md': '# Real Title'
    };
    const { linkUpdater, sourceFile, vault } = setupTest(files, {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[link](note2.md)' }] as LinkCache[],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: undefined,
        headings: [{ heading: 'Real Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    });

    // Simulate the user typing right after the plugin reads the note: the
    // new line lands in the window between the read and the write.
    let userHasTyped = false;
    vault.read.mockImplementation((file: TFile) => {
      const content = files[file.path] || '';
      if (file.path === 'note1.md' && !userHasTyped) {
        userHasTyped = true;
        files[file.path] = content + '\nuser typed this';
      }
      return Promise.resolve(content);
    });

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    // Both the link update and the user's concurrent edit must survive.
    expect(files['note1.md']).toBe('See [Real Title](note2.md)\nuser typed this');
  });

  it('should not write at all when no links need updating', async () => {
    const files: Record<string, string> = {
      'note1.md': 'See [Real Title](note2.md)',
      'note2.md': '# Real Title'
    };
    const { linkUpdater, sourceFile, vault } = setupTest(files, {
      'note1.md': {
        links: [{ link: 'note2.md', original: '[Real Title](note2.md)' }] as LinkCache[],
        frontmatter: undefined
      } as CachedMetadata,
      'note2.md': {
        frontmatter: undefined,
        headings: [{ heading: 'Real Title' }] as HeadingCache[],
        links: []
      } as CachedMetadata
    });

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(0);
    // No write may happen: writing identical content still touches the file
    // and re-triggers the metadata 'changed' event, causing a rewrite loop.
    expect(vault.modify).not.toHaveBeenCalled();
    expect(vault.process).not.toHaveBeenCalled();
  });
});
