import {
  Plugin,
  HeadingCache,
  FrontMatterCache,
  CachedMetadata,
  TFile,
  Notice
} from "obsidian";

interface BetterMarkdownLinksSettings {}

export default class BetterMarkdownLinksPlugin extends Plugin {
  settings: BetterMarkdownLinksSettings;

  async onload() {
    this.registerEvent(
      this.app.vault.on("rename", async (file: TFile, oldPath) => {
        this.updateBackLinks(file, oldPath);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", async (file: TFile) => {
        this.updateBackLinks(file, file.path);
      })
    );
  }

  async updateBackLinks(file: TFile, oldPath: string) {
      if (
        !oldPath ||
        !file.path.toLocaleLowerCase().endsWith(".md") ||
        !(file instanceof TFile)
      ) {
        return;
      }

      const cachedFile = this.app.metadataCache.getFileCache(file);
      if (!cachedFile) {
        return;
      }
      const title = this.getPageTitle(cachedFile);
      const notes = this.getCachedNotesThatHaveLinkToFile(oldPath)

      let updatedBacklinksCount = 0;

      for (let note of notes) {
        const fileContent = await this.app.vault.read(note);
        const newFileContent = fileContent.replace(
          /\[(.*?)\]\((.*?)\)/g,
          (_, linkText, linkUrl) => {
            linkUrl = decodeURIComponent(linkUrl);
            if (linkUrl === oldPath) {
              return `[${title}](${encodeURIComponent(file.path)})`;
            }
            return `[${linkText}](${linkUrl})`;
          }
        );
        
        if (fileContent !== newFileContent) {
          await this.app.vault.modify(note, newFileContent);
          updatedBacklinksCount++;
        }
      }

      if (updatedBacklinksCount > 0) {
        new Notice(`${updatedBacklinksCount} backlink(s) updated.`);
      };
  };

  getCachedNotesThatHaveLinkToFile(filePath: string): TFile[] {
		let notes: TFile [] = [];
		let allNotes = this.app.vault.getMarkdownFiles();

		if (allNotes) {
			for (let note of allNotes) {
				let notePath = note.path;
				if (note.path == filePath)
					continue;

				let embeds = this.app.metadataCache.getCache(notePath)?.embeds;
				if (embeds) {
					for (let link_data of embeds) {
            if (link_data.link == filePath) {
              notes.push(note);
            }
					}
				}

				let links = this.app.metadataCache.getCache(notePath)?.links;
				if (links) {
					for (let link_data of links) {
            if (link_data.link == filePath) {
              notes.push(note);
            }
					}
				}
			}
		}

		return notes;
	}

  getPageTitle(cache: CachedMetadata): string {
    const frontMatterTitle = cache.frontmatter && (cache.frontmatter as FrontMatterCache).title;
    const firstHeading = cache.headings && (cache.headings[0] as HeadingCache).heading;
    return frontMatterTitle || firstHeading || "";
  }
}
