import { CachedMetadata, HeadingCache } from 'obsidian';
import { setupTest } from './test-utils';

const titledNote = (title: string): CachedMetadata => ({
  frontmatter: undefined,
  headings: [{ heading: title }] as HeadingCache[],
  links: []
});

describe('LinkUpdater - Link exclusions', () => {
  it('should preserve individual links followed by an ignore directive', async () => {
    const content = [
      '[Custom markdown](note2.md)%%talt:ignore%%',
      '[[note2|Custom wiki]] %%talt:ignore%%',
      '[old](note2.md)',
      '[[note2|old]]'
    ].join('\n');
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      {
        'note1.md': { frontmatter: undefined, links: [] } as CachedMetadata,
        'note2.md': titledNote('Real Title')
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(2);
    expect(await vault.read(sourceFile)).toBe([
      '[Custom markdown](note2.md)%%talt:ignore%%',
      '[[note2|Custom wiki]] %%talt:ignore%%',
      '[Real Title](note2.md)',
      '[[note2|Real Title]]'
    ].join('\n'));
  });

  it('should preserve links to targets listed in source-note frontmatter', async () => {
    const content = [
      '---',
      'title-as-link-text-ignore:',
      '  - "[[note2]]"',
      '---',
      '[[note2|Custom wiki]]',
      '[Custom markdown](note2.md)',
      '[[note3|old]]'
    ].join('\n');
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': content,
        'note2.md': '# Real Two',
        'note3.md': '# Real Three'
      },
      {
        'note1.md': {
          frontmatter: {
            'title-as-link-text-ignore': ['[[note2]]']
          },
          links: []
        } as CachedMetadata,
        'note2.md': titledNote('Real Two'),
        'note3.md': titledNote('Real Three')
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);

    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe([
      '---',
      'title-as-link-text-ignore:',
      '  - "[[note2]]"',
      '---',
      '[[note2|Custom wiki]]',
      '[Custom markdown](note2.md)',
      '[[note3|Real Three]]'
    ].join('\n'));
  });

  it('should accept a raw link path as a target-wide exclusion', async () => {
    const content = [
      '---',
      'title-as-link-text-ignore:',
      '  - note2',
      '---',
      '[[note2|Custom wiki]]',
      '[Custom markdown](note2.md)'
    ].join('\n');
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      {
        'note1.md': {
          frontmatter: { 'title-as-link-text-ignore': ['note2'] },
          links: []
        } as CachedMetadata,
        'note2.md': titledNote('Real Title')
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe(content);
  });

  it('should limit aliased exclusions to the exact target and display text', async () => {
    const content = [
      '---',
      'title-as-link-text-ignore:',
      '  - "[[note2|Custom name]]"',
      '---',
      '[[note2|Custom name]]',
      '[Custom name](note2.md)',
      '[[note2|Other name]]',
      '[Other name](note2.md)'
    ].join('\n');
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      {
        'note1.md': {
          frontmatter: {
            'title-as-link-text-ignore': ['[[note2|Custom name]]']
          },
          links: []
        } as CachedMetadata,
        'note2.md': titledNote('Real Title')
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(2);
    expect(await vault.read(sourceFile)).toBe([
      '---',
      'title-as-link-text-ignore:',
      '  - "[[note2|Custom name]]"',
      '---',
      '[[note2|Custom name]]',
      '[Custom name](note2.md)',
      '[[note2|Real Title]]',
      '[Real Title](note2.md)'
    ].join('\n'));
  });
});
