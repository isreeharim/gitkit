import type { ImportStatement, SourceLanguage } from '@/types/dependency';
import type { ISourceParser } from './types';

/**
 * Deterministic source parser for JavaScript, TypeScript, JSX, and TSX files.
 * Extracts static imports, type imports, dynamic imports, re-exports, and require calls.
 */
export class JavaScriptTypeScriptParser implements ISourceParser {
  readonly language: SourceLanguage = 'typescript';

  canParse(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'].includes(ext);
  }

  getSpecificLanguage(filePath: string): SourceLanguage {
    const ext = this.getExtension(filePath);
    if (ext === 'jsx') return 'jsx';
    if (ext === 'tsx') return 'tsx';
    if (['ts', 'mts', 'cts'].includes(ext)) return 'typescript';
    return 'javascript';
  }

  private getExtension(filePath: string): string {
    const dotIndex = filePath.lastIndexOf('.');
    return dotIndex !== -1 ? filePath.slice(dotIndex + 1).toLowerCase() : '';
  }

  extractImports(content: string): ImportStatement[] {
    const statements: ImportStatement[] = [];
    const sanitized = this.stripComments(content);
    const lines = sanitized.split('\n');

    // Regex patterns for various import styles
    // 1. Static imports: import ... from ['"]...['"]
    const staticImportRegex =
      /^\s*import\s+(?:(type)\s+)?(?:([\w*\s{},$]+)\s+from\s+)?['"]([^'"]+)['"]/m;

    // 2. Side-effect imports: import ['"]...['"]
    const sideEffectRegex = /^\s*import\s+['"]([^'"]+)['"]/m;

    // 3. Export from: export ... from ['"]...['"]
    const exportFromRegex =
      /^\s*export\s+(?:(type)\s+)?(?:([\w*\s{},$]+)\s+from\s+)?['"]([^'"]+)['"]/m;

    // 4. Dynamic import: import(['"]...['"])
    const dynamicImportRegex = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    // 5. Require call: require(['"]...['"])
    const requireRegex = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let inMultilineStatement = false;
    let accumulatedStatement = '';
    let statementStartLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Check dynamic imports in the line
      let dynamicMatch: RegExpExecArray | null;
      while ((dynamicMatch = dynamicImportRegex.exec(line)) !== null) {
        statements.push({
          specifier: dynamicMatch[1],
          importedSymbols: ['*'],
          isTypeOnly: false,
          isDynamic: true,
          line: lineNum,
          column: dynamicMatch.index + 1,
        });
      }

      // Check require calls in the line
      let requireMatch: RegExpExecArray | null;
      while ((requireMatch = requireRegex.exec(line)) !== null) {
        statements.push({
          specifier: requireMatch[1],
          importedSymbols: ['*'],
          isTypeOnly: false,
          isDynamic: false,
          line: lineNum,
          column: requireMatch.index + 1,
        });
      }

      // Handle multiline static import/export statements
      const trimmed = line.trim();
      if (!inMultilineStatement) {
        if (
          (trimmed.startsWith('import ') ||
            trimmed.startsWith('import{') ||
            trimmed.startsWith('export ') ||
            trimmed.startsWith('export{')) &&
          !trimmed.includes(';') &&
          !/['"][^'"]+['"]\s*;?$/.test(trimmed)
        ) {
          inMultilineStatement = true;
          accumulatedStatement = trimmed;
          statementStartLine = lineNum;
          continue;
        }
      } else {
        accumulatedStatement += ' ' + trimmed;
        if (trimmed.includes(';') || /['"][^'"]+['"]\s*;?$/.test(trimmed)) {
          inMultilineStatement = false;
          this.parseSingleStatement(
            accumulatedStatement,
            statementStartLine,
            staticImportRegex,
            sideEffectRegex,
            exportFromRegex,
            statements
          );
          accumulatedStatement = '';
        }
        continue;
      }

      // Single line static statement
      this.parseSingleStatement(
        line,
        lineNum,
        staticImportRegex,
        sideEffectRegex,
        exportFromRegex,
        statements
      );
    }

    return statements;
  }

  private parseSingleStatement(
    rawText: string,
    lineNum: number,
    staticImportRegex: RegExp,
    sideEffectRegex: RegExp,
    exportFromRegex: RegExp,
    targetList: ImportStatement[]
  ): void {
    // 1. Static import
    const staticMatch = staticImportRegex.exec(rawText);
    if (staticMatch) {
      const isType = Boolean(staticMatch[1]);
      const clause = staticMatch[2];
      const specifier = staticMatch[3];
      targetList.push({
        specifier,
        importedSymbols: this.parseImportClause(clause),
        isTypeOnly: isType,
        isDynamic: false,
        line: lineNum,
      });
      return;
    }

    // 2. Side-effect import
    const sideEffectMatch = sideEffectRegex.exec(rawText);
    if (sideEffectMatch) {
      targetList.push({
        specifier: sideEffectMatch[1],
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: lineNum,
      });
      return;
    }

    // 3. Export from
    const exportMatch = exportFromRegex.exec(rawText);
    if (exportMatch) {
      const isType = Boolean(exportMatch[1]);
      const clause = exportMatch[2];
      const specifier = exportMatch[3];
      targetList.push({
        specifier,
        importedSymbols: this.parseImportClause(clause),
        isTypeOnly: isType,
        isDynamic: false,
        line: lineNum,
      });
    }
  }

  private parseImportClause(clause?: string): string[] {
    if (!clause) return ['*'];
    const trimmed = clause.trim();
    if (!trimmed) return ['*'];

    const symbols: string[] = [];

    // Check for default import: import Foo, { Bar } from '...'
    const parts = trimmed.split(',');
    for (const part of parts) {
      const clean = part.replace(/[{}]/g, '').trim();
      if (!clean) continue;
      // Handle "Bar as Baz" or "type Bar"
      const words = clean.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const symbol = words[0] === 'type' && words.length > 1 ? words[1] : words[0];
        symbols.push(symbol);
      }
    }

    return symbols.length > 0 ? symbols : ['*'];
  }

  /**
   * Strips single-line and multi-line comments while preserving newlines
   * so line numbers remain accurate.
   */
  private stripComments(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, (match) => {
        const lineBreaks = match.split('\n').length - 1;
        return '\n'.repeat(lineBreaks);
      })
      .replace(/\/\/[^\n]*/g, '');
  }
}
