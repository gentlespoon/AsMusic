declare module 'kuroshiro' {
  type ConvertOptions = { to: string; romajiSystem?: string };

  export default class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(str: string, options: ConvertOptions): Promise<string>;
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
  export default class KuromojiAnalyzer {
    constructor(options: { dictPath: string });
  }
}
