import TitleAsLinkTextPlugin from '../main';
import { TFile } from 'obsidian';

type EventHandler = (...args: unknown[]) => void;

const createFile = (path: string): TFile => {
  const file = new (TFile as unknown as new (path: string, name: string) => TFile)(
    path,
    path
  );
  return file;
};

const createPlugin = () => {
  const handlers: Record<string, EventHandler> = {};
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
      getFileCache: jest.fn().mockReturnValue(null),
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

  return { plugin, handlers, read };
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
});
