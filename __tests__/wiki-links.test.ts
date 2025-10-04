import { CachedMetadata, HeadingCache } from 'obsidian';
import { setupTest } from './test-utils';

describe('LinkUpdater - Wiki links', () => {
  it('should update wikilink text based on frontmatter title', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2|link]]',
        'note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2',
            original: '[[note2|link]]',
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
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2|Front Matter Title]]');
  });

  it('should not update wikilink text if it matches an alias', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2|World]]',
        'note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2',
            original: '[[note2|World]]',
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
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2|World]]');
  });

  it('should not update wikilink text with subheading', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2#Subheading|link]]',
        'note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2#Subheading',
            original: '[[note2#Subheading|link]]',
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
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2#Subheading|link]]');
  });

  it('should add display text to wikilink without alias when title differs', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2]]',
        'note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2',
            original: '[[note2]]',
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
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2|Different Title]]');
  });

  it('should not add display text to wikilink when title matches filename', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2]]',
        'note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2',
            original: '[[note2]]',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'note2.md': {
          frontmatter: { title: 'note2' },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2]]');
  });

  it('should handle case-insensitive title matching', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[dogs]]',
        'dogs.md': 'Content about dogs'
      },
      {
        'note1.md': {
          links: [{
            link: 'dogs',
            original: '[[dogs]]',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'dogs.md': {
          frontmatter: { title: 'dogs' },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[dogs]]');
  });

  it('should add display text for nested path wikilinks when title differs', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[folder/note2]]',
        'folder/note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'folder/note2',
            original: '[[folder/note2]]',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'folder/note2.md': {
          frontmatter: { title: 'Different Title' },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(1);
    expect(await vault.read(sourceFile)).toBe('Here is a [[folder/note2|Different Title]]');
  });

  it('should not update wikilinks with subheadings but no display text', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[note2#Section]]',
        'note2.md': 'Content of note 2'
      },
      {
        'note1.md': {
          links: [{
            link: 'note2#Section',
            original: '[[note2#Section]]',
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
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[note2#Section]]');
  });

  it('should not add display text to wikilink when heading matches filename', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[dogs]]',
        'dogs.md': 'Content about dogs'
      },
      {
        'note1.md': {
          links: [{
            link: 'dogs',
            original: '[[dogs]]',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'dogs.md': {
          frontmatter: undefined,
          headings: [{ heading: 'dogs' }] as HeadingCache[],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[dogs]]');
  });

  it('should not add display text to wikilink when there are no headings or title', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[dogs]]',
        'dogs.md': 'Content about dogs'
      },
      {
        'note1.md': {
          links: [{
            link: 'dogs',
            original: '[[dogs]]',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'dogs.md': {
          frontmatter: undefined,
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[dogs]]');
  });

  it('should not update link text to alias when it matches the title exactly', async () => {
    const { linkUpdater, sourceFile, vault } = setupTest(
      {
        'note1.md': 'Here is a [[dogs|Dogs]]',
        'dogs.md': 'Content about dogs'
      },
      {
        'note1.md': {
          links: [{
            link: 'dogs',
            original: '[[dogs|Dogs]]',
          }],
          frontmatter: undefined
        } as CachedMetadata,
        'dogs.md': {
          frontmatter: {
            title: 'Dogs',
            aliases: ['Doggos']
          },
          headings: [],
          links: []
        } as CachedMetadata
      }
    );

    const updatedCount = await linkUpdater.updateLinksInNote(sourceFile);
    expect(updatedCount).toBe(0);
    expect(await vault.read(sourceFile)).toBe('Here is a [[dogs|Dogs]]');
  });
}); 