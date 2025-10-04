import { setupTest } from './test-utils';
import { CachedMetadata, HeadingCache } from 'obsidian';

describe('LinkUpdater - Subheading links', () => {
  it('should not update links with subheadings and display text', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2#My Heading|My Heading]]',
        'note2.md': '# Different Title\n\n## My Heading\n\nContent'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2#My Heading',
            original: '[[note2#My Heading|My Heading]]',
            displayText: 'My Heading'
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'note2.md': {
          frontmatter: { title: 'Page Title' },
          headings: [
            { heading: 'Different Title', level: 1 } as HeadingCache,
            { heading: 'My Heading', level: 2 } as HeadingCache
          ],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2#My Heading|My Heading]]');
  });

  it('should not update links with subheadings without display text', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2#Installation]]',
        'note2.md': '# Page\n\n## Installation\n\nContent'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2#Installation',
            original: '[[note2#Installation]]'
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'note2.md': {
          frontmatter: { title: 'Complete Guide' },
          headings: [
            { heading: 'Page', level: 1 } as HeadingCache,
            { heading: 'Installation', level: 2 } as HeadingCache
          ],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2#Installation]]');
  });

  it('should not update links with block references', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2#^quote|old text]]',
        'note2.md': '# Different Title\n\nSome content'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2#^quote',
            original: '[[note2#^quote|old text]]',
            displayText: 'old text'
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'note2.md': {
          frontmatter: { title: 'Page Title' },
          headings: [
            { heading: 'Different Title', level: 1 } as HeadingCache
          ],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2#^quote|old text]]');
  });
});
