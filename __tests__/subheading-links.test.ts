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

  it('should not update Markdown links to headings or blocks in another note', async () => {
    const content = [
      '[Custom heading](note2.md#My%20Heading)',
      '[Custom block](note2.md#^quote)'
    ].join('\n');
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': content,
        'note2.md': '# Page title\n\n## My Heading\n\nQuote ^quote'
      },
      {
        'note1.md': { frontmatter: undefined, links: [] } as CachedMetadata,
        'note2.md': {
          frontmatter: { title: 'Page Title' },
          headings: [{ heading: 'My Heading', level: 2 } as HeadingCache],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe(content);
  });

  it('should not update same-note wikilinks to headings or blocks', async () => {
    const content = [
      '[[#My Heading|Custom heading]]',
      '[[#^quote|Custom block]]'
    ].join('\n');
    const { linkUpdater, sourceFile, vault, metadataCache } = setupTest(
      { 'note1.md': content },
      {
        'note1.md': {
          frontmatter: { title: 'Page Title' },
          headings: [{ heading: 'My Heading', level: 2 } as HeadingCache],
          links: []
        } as CachedMetadata
      }
    );
    metadataCache.getFirstLinkpathDest.mockImplementation((linkPath: string) => {
      return linkPath.startsWith('#') ? sourceFile : null;
    });

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe(content);
  });

  it('should fill empty Markdown labels without dropping heading or block destinations', async () => {
    const content = [
      '[](note2.md#My%20Heading)',
      '[](note2.md#^test-here)'
    ].join('\n');
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': content,
        'note2.md': '# Page title\n\n## My Heading\n\nBlock ^test-here'
      },
      {
        'note1.md': { frontmatter: undefined, links: [] } as CachedMetadata,
        'note2.md': {
          frontmatter: { title: 'Page Title' },
          headings: [{ heading: 'My Heading', level: 2 } as HeadingCache],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(2);
    expect(await vault.read(sourceFile)).toBe([
      '[Page Title](note2.md#My%20Heading)',
      '[Page Title](note2.md#^test-here)'
    ].join('\n'));
  });
});
