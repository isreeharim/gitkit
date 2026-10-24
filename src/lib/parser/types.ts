import type { ImportStatement, SourceLanguage } from '@/types/dependency';

export interface ISourceParser {
  readonly language: SourceLanguage;
  canParse(filePath: string): boolean;
  extractImports(content: string, filePath?: string): ImportStatement[];
}
