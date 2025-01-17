export class Plugin {
  app: any;
  registerEvent(_: any) {}
  addCommand(_: any) {}
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
  [key: string]: any;
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

export function debounce(func: Function, timeout: number, immediate?: boolean) {
  return func;
}

export class Notice {
  constructor(message: string) {
    console.log(message);
  }
}

export interface TAbstractFile {
  path: string;
} 