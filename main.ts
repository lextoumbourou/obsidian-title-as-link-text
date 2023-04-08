import {
	Plugin,
	TFile,
	debounce,
	Notice,
	MarkdownView,
	CachedMetadata,
	Editor,
  } from 'obsidian';

  // Remember to rename these classes and interfaces!

interface BetterMarkdownLinksSettings {
}
  
  export default class BetterMarkdownLinksPlugin extends Plugin {
	settings: BetterMarkdownLinksSettings;

	private updateLinks: ((file: TFile) => Promise<void>) | ReturnType<typeof debounce>;
  
	async onload() {
	  this.updateLinks = debounce(this.updateLinksImpl.bind(this), 500, true);
  
	  this.registerEvent(
		this.app.workspace.on('file-open', (file: TFile) => {
			if (file) {
				this.updateLinks(file);
			}
		})
	  );
  
	  this.registerEvent(
		this.app.vault.on('rename', (_, newPath) => {
		  const newFile = this.app.vault.getAbstractFileByPath(newPath) as TFile;
		  if (newFile) {
			this.updateLinks(newFile);
		  }
		})
	  );
  
	  this.registerEvent(
		this.app.metadataCache.on('changed', (file) => {
		  this.updateLinks(file);
		})
	  );
	}
  
	async updateLinksImpl(file: TFile) {
	  if (file.extension !== 'md') {
		return;
	  }
  
	  const cache = this.app.metadataCache.getFileCache(file)
  
	  if (!cache) {
		return;
	  }
  
	  const view = this.app.workspace.getActiveViewOfType(MarkdownView);
	  if (!view || view.file !== file) {
		return;
	  }
  
	  const editor = view.editor;
	  const title = getTitle(cache);
	  const oldLink = getOldLink(editor);
  
	  if (title && oldLink) {
		const newLink = `[${title}](${file.basename})`;
		editor.replaceRange(newLink, oldLink.from, oldLink.to);
		new Notice('Markdown link updated.');
	  }
	}
  }
  
  function getTitle(cache: CachedMetadata) {
	const frontMatterTitle = cache.frontmatter && cache.frontmatter['title'];
	const firstHeader = cache.headings && cache.headings[0];
  
	if (frontMatterTitle) {
	  return frontMatterTitle;
	} else if (firstHeader) {
	  return firstHeader.heading;
	} else {
	  return null;
	}
  }
  
  function getOldLink(editor: Editor) {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
  
	const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	let match;
  
	while ((match = markdownLinkRegex.exec(line)) !== null) {
	  const from = { line: cursor.line, ch: match.index };
	  const to = { line: cursor.line, ch: match.index + match[0].length };
  
	  if (cursor.ch >= from.ch && cursor.ch <= to.ch) {
		return { from, to };
	  }
	}
  
	return null;
  }