export class Plugin {
  app: unknown;
}

export class TFile {
  path: string;
  name: string;

  constructor(path: string, name: string) {
    this.path = path;
    this.name = name;
  }
}

export interface HeadingCache {
  heading: string;
  level: number;
  position: {
    start: { line: number; col: number; offset: number };
    end: { line: number; col: number; offset: number };
  };
}

export interface FrontMatterCache {
  title?: string;
  [key: string]: unknown;
}

export interface CachedMetadata {
  links?: Array<{
    link: string;
    original: string;
  }>;
  embeds?: Array<{
    link: string;
    original: string;
  }>;
  headings?: HeadingCache[];
  frontmatter?: FrontMatterCache;
}

export function debounce(
  func: (...args: unknown[]) => unknown,
  _timeout: number,
  _immediate?: boolean
) {
  return func;
}

export class Notice {
  constructor(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

export interface TAbstractFile {
  path: string;
} 