import { CachedMetadata, HeadingCache, LinkCache } from 'obsidian';
import { setupTest } from './test-utils';

const note2Metadata = {
  frontmatter: undefined,
  headings: [{ heading: 'Real Title' }] as HeadingCache[],
  links: []
} as CachedMetadata;

const note1Metadata = (original: string) => ({
  links: [{ link: 'note2.md', original }] as LinkCache[],
  frontmatter: undefined
} as CachedMetadata);

describe('LinkUpdater - Code blocks', () => {
  it('should not update markdown links inside fenced code blocks', async () => {
    const content = '[link](note2.md)\n```\n[link](note2.md)\n```';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe(
      '[Real Title](note2.md)\n```\n[link](note2.md)\n```'
    );
  });

  it('should not update wikilinks inside fenced code blocks', async () => {
    const content = '[[note2]]\n```\n[[note2]]\n```';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[[note2]]'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe(
      '[[note2|Real Title]]\n```\n[[note2]]\n```'
    );
  });

  it('should not update links inside tilde fenced code blocks', async () => {
    const content = '~~~\n[link](note2.md)\n[[note2]]\n~~~';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe(content);
  });

  it('should not update links inside fenced code blocks with a language tag', async () => {
    const content = '```markdown\n[link](note2.md)\n```';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe(content);
  });

  it('should not update links inside inline code', async () => {
    const content = 'Use `[link](note2.md)` and ``[[note2]]`` here, but [link](note2.md) works';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe(
      'Use `[link](note2.md)` and ``[[note2]]`` here, but [Real Title](note2.md) works'
    );
  });

  it('should not update links inside inline code containing shorter backtick runs', async () => {
    const content = 'Use ``code ` [link](note2.md) ` code`` here';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe(content);
  });

  it('should update wikilinks used as YAML frontmatter properties', async () => {
    const content = '---\npeople: [[note2|Old Name]]\n---\nBody';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[[note2|Old Name]]'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe(
      '---\npeople: [[note2|Real Title]]\n---\nBody'
    );
  });

  it('should protect everything after an unclosed fence', async () => {
    const content = '[link](note2.md)\n```\n[link](note2.md)\n[[note2]]';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe(
      '[Real Title](note2.md)\n```\n[link](note2.md)\n[[note2]]'
    );
  });

  it('should still update links between two code blocks', async () => {
    const content = '```\n[[note2]]\n```\n[link](note2.md)\n```\n[[note2]]\n```';
    const { linkUpdater, sourceFile, vault } = setupTest(
      { 'note1.md': content, 'note2.md': '# Real Title' },
      { 'note1.md': note1Metadata('[link](note2.md)'), 'note2.md': note2Metadata }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe(
      '```\n[[note2]]\n```\n[Real Title](note2.md)\n```\n[[note2]]\n```'
    );
  });
});
