import TitleAsLinkTextPlugin from '../main';
import { TFile } from 'obsidian';
import type { Editor, EditorPosition } from 'obsidian';

type EventHandler = (...args: unknown[]) => void;
type Command = {
  id: string;
  callback?: () => void | Promise<void>;
  editorCheckCallback?: (checking: boolean, editor: Editor) => boolean | void;
};

const createEditor = (initialLine: string, cursorCh: number) => {
  let line = initialLine;
  let cursor: EditorPosition = { line: 0, ch: cursorCh };
  const replaceRange = jest.fn(
    (replacement: string, from: EditorPosition, to: EditorPosition = from) => {
      line = line.slice(0, from.ch) + replacement + line.slice(to.ch);
    }
  );
  const editor = {
    getCursor: () => cursor,
    setCursor: (position: EditorPosition) => {
      cursor = position;
    },
    getLine: () => line,
    replaceRange
  } as unknown as Editor;

  return { editor, replaceRange, getLine: () => line };
};

const createFile = (path: string): TFile => {
  const file = new (TFile as unknown as new (path: string, name: string) => TFile)(
    path,
    path
  );
  (file as unknown as { extension: string }).extension = path.split('.').pop() || '';
  return file;
};

const createPlugin = () => {
  const handlers: Record<string, EventHandler> = {};
  const commands: Record<string, Command> = {};
  const read = jest.fn().mockResolvedValue('');

  const app = {
    vault: {
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      read,
      modify: jest.fn().mockResolvedValue(undefined),
      on: jest.fn((name: string, handler: EventHandler) => {
        handlers[`vault:${name}`] = handler;
      }),
    },
    metadataCache: {
      // A non-null cache so updateLinksInNote proceeds to vault.read, which
      // the tests use to observe which files were processed.
      getFileCache: jest.fn().mockReturnValue({}),
      getCache: jest.fn().mockReturnValue(null),
      getFirstLinkpathDest: jest.fn().mockReturnValue(null),
      on: jest.fn((name: string, handler: EventHandler) => {
        handlers[`metadataCache:${name}`] = handler;
      }),
    },
    workspace: {
      getActiveFile: jest.fn().mockReturnValue(null),
    },
  };

  // The mock Plugin constructor takes no arguments; cast past the real
  // obsidian (app, manifest) signature.
  const plugin = new (TitleAsLinkTextPlugin as unknown as new () => TitleAsLinkTextPlugin)();
  (plugin as unknown as { app: unknown }).app = app;
  (plugin as unknown as { addCommand: (command: Command) => void }).addCommand = (command) => {
    commands[command.id] = command;
  };

  return { plugin, handlers, commands, read, app };
};

describe('TitleAsLinkTextPlugin - debounced updates', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should update both files when two files change within the debounce window', async () => {
    const { plugin, handlers, read } = createPlugin();
    await plugin.onload();

    handlers['metadataCache:changed'](createFile('a.md'));
    handlers['metadataCache:changed'](createFile('b.md'));

    jest.advanceTimersByTime(1500);

    const readPaths = read.mock.calls.map(([file]) => (file as TFile).path);
    expect(readPaths).toContain('a.md');
    expect(readPaths).toContain('b.md');
  });

  it('should collapse rapid changes to the same file into one update', async () => {
    const { plugin, handlers, read } = createPlugin();
    await plugin.onload();

    const file = createFile('a.md');
    handlers['metadataCache:changed'](file);
    jest.advanceTimersByTime(500);
    handlers['metadataCache:changed'](file);

    // 500ms after the second change: the reset timer should not have fired.
    jest.advanceTimersByTime(500);
    expect(read).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);
    expect(read).toHaveBeenCalledTimes(1);
    expect((read.mock.calls[0][0] as TFile).path).toBe('a.md');
  });

  it('should collapse a rename followed by a change of the same file', async () => {
    const { plugin, handlers, read } = createPlugin();
    await plugin.onload();

    const file = createFile('a.md');
    handlers['vault:rename'](file, 'old.md');
    handlers['metadataCache:changed'](file);

    jest.advanceTimersByTime(1500);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('should update only the active note for the current-file command', async () => {
    const { plugin, commands, read, app } = createPlugin();
    const activeFile = createFile('active.md');
    const backlinkFile = createFile('backlink.md');
    app.workspace.getActiveFile.mockReturnValue(activeFile);
    app.vault.getMarkdownFiles.mockReturnValue([activeFile, backlinkFile]);
    app.metadataCache.getCache.mockImplementation((path: string) => {
      return path === backlinkFile.path
        ? { links: [{ link: 'active', original: '[[active]]' }] }
        : null;
    });
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkPath: string) => {
      return linkPath === 'active' ? activeFile : null;
    });
    await plugin.onload();

    const callback = commands['update-current-file-links'].callback;
    if (!callback) {
      throw new Error('Expected current-file command callback');
    }
    await callback();

    const readPaths = read.mock.calls.map(([file]) => (file as TFile).path);
    expect(readPaths).toEqual(['active.md']);
  });

  it.each([
    ['wikilink', 'See [[person|Custom text]] today', 'Custom text', 'See [[person|Custom text]]%%talt:ignore%% today'],
    ['Markdown link', 'See [Custom text](person.md) today', 'Custom text', 'See [Custom text](person.md)%%talt:ignore%% today']
  ])('should toggle an ignore directive for a %s under the cursor', async (_name, line, cursorText, preservedLine) => {
    const { plugin, commands } = createPlugin();
    await plugin.onload();
    const { editor, getLine } = createEditor(line, line.indexOf(cursorText) + 2);
    const toggle = commands['toggle-link-text-updates'].editorCheckCallback;
    if (!toggle) {
      throw new Error('Expected toggle command editor callback');
    }

    expect(toggle(true, editor)).toBe(true);
    expect(toggle(false, editor)).toBe(true);
    expect(getLine()).toBe(preservedLine);

    expect(toggle(false, editor)).toBe(true);
    expect(getLine()).toBe(line);
  });

  it('should disable the toggle command when the cursor is not in a link', async () => {
    const { plugin, commands } = createPlugin();
    await plugin.onload();
    const { editor, replaceRange } = createEditor('No link here', 3);
    const toggle = commands['toggle-link-text-updates'].editorCheckCallback;
    if (!toggle) {
      throw new Error('Expected toggle command editor callback');
    }

    expect(toggle(true, editor)).toBe(false);
    expect(toggle(false, editor)).toBe(false);
    expect(replaceRange).not.toHaveBeenCalled();
  });
});
