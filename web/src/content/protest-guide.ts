import content from './protest-guide.json';

export interface GuideBlock {
  readonly id: string;
  /** Trusted editorial GFM, not HTML or executable MDX. */
  readonly markdown: string;
}

export interface GuideSourceLink {
  readonly label: string;
  readonly url: string;
}

export interface GuideSection {
  readonly id: string;
  readonly sourceSection: number;
  readonly title: string;
  readonly blocks: readonly GuideBlock[];
  readonly sourceLinks: readonly GuideSourceLink[];
}

export interface GuideChapter {
  readonly id: string;
  readonly anchor: string;
  readonly number: string;
  readonly title: string;
  readonly sections: readonly GuideSection[];
  readonly sourceLinks: readonly GuideSourceLink[];
}

export interface ProtestGuide {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly reviewedDate: string;
  readonly title: string;
  readonly sourceSha256: string;
  readonly introduction: readonly GuideBlock[];
  readonly calendarStatus: {
    readonly asOfDate: string;
    readonly sourceSection: number;
    readonly placement: string;
    readonly markdown: string;
    readonly confirmedOperatingDates: readonly { readonly date: string; readonly label: string }[];
  };
  readonly chapters: readonly GuideChapter[];
  readonly disclaimer: GuideSection;
  readonly sourceLinks: readonly GuideSourceLink[];
}

/** Shared by the website and printable guide; do not copy prose into renderers. */
export const protestGuide: ProtestGuide = content;
