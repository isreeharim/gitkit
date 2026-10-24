import type { ImportStatement, SourceLanguage } from '@/types/dependency';
import type { ISourceParser } from './types';

/**
 * Deterministic source parser for Python (.py) files.
 * Extracts `import ...` and `from ... import ...` statements including
 * relative imports (., .., ...), multiline parenthesized imports, and aliases.
 */
export class PythonParser implements ISourceParser {
  readonly language: SourceLanguage = 'python';

  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.py');
  }

  extractImports(content: string): ImportStatement[] {
    const statements: ImportStatement[] = [];
    const sanitized = this.stripCommentsAndDocstrings(content);
    const lines = sanitized.split('\n');

    let inMultilineFrom = false;
    let multilineModule = '';
    let accumulatedSymbols: string[] = [];
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const trimmed = line.trim();

      // Handle multiline parenthesized from ... import ( ... )
      if (inMultilineFrom) {
        if (trimmed.includes(')')) {
          const beforeParen = trimmed.split(')')[0];
          this.collectSymbols(beforeParen, accumulatedSymbols);
          statements.push({
            specifier: multilineModule,
            importedSymbols: [...accumulatedSymbols],
            isTypeOnly: false,
            isDynamic: false,
            line: startLine,
          });
          inMultilineFrom = false;
          multilineModule = '';
          accumulatedSymbols = [];
        } else {
          this.collectSymbols(trimmed, accumulatedSymbols);
        }
        continue;
      }

      if (!trimmed) continue;

      // 1. from <module> import ( ... )
      const fromParenMatch = /^\s*from\s+([.\w]+)\s+import\s*\((.*)$/.exec(line);
      if (fromParenMatch) {
        inMultilineFrom = true;
        multilineModule = fromParenMatch[1];
        startLine = lineNum;
        accumulatedSymbols = [];
        const afterParen = fromParenMatch[2];
        if (afterParen.includes(')')) {
          inMultilineFrom = false;
          this.collectSymbols(afterParen.split(')')[0], accumulatedSymbols);
          statements.push({
            specifier: multilineModule,
            importedSymbols: [...accumulatedSymbols],
            isTypeOnly: false,
            isDynamic: false,
            line: startLine,
          });
        } else {
          this.collectSymbols(afterParen, accumulatedSymbols);
        }
        continue;
      }

      // 2. from <module> import <symbols>
      const fromMatch = /^\s*from\s+([.\w]+)\s+import\s+([*\w\s,]+)$/.exec(line);
      if (fromMatch) {
        const moduleSpecifier = fromMatch[1];
        const symbolsStr = fromMatch[2];
        const symbols: string[] = [];
        this.collectSymbols(symbolsStr, symbols);
        statements.push({
          specifier: moduleSpecifier,
          importedSymbols: symbols.length > 0 ? symbols : ['*'],
          isTypeOnly: false,
          isDynamic: false,
          line: lineNum,
        });
        continue;
      }

      // 3. import <module1> [as a1], <module2> [as a2]
      const importMatch = /^\s*import\s+([.\w\s,]+)$/.exec(line);
      if (importMatch) {
        const rawModules = importMatch[1].split(',');
        for (const rawMod of rawModules) {
          const modTrimmed = rawMod.trim();
          if (!modTrimmed) continue;
          // Check for "module as alias"
          const parts = modTrimmed.split(/\s+as\s+/);
          const moduleName = parts[0].trim();
          const alias = parts.length > 1 ? parts[1].trim() : undefined;

          statements.push({
            specifier: moduleName,
            importedSymbols: alias ? [alias] : ['*'],
            isTypeOnly: false,
            isDynamic: false,
            line: lineNum,
          });
        }
      }
    }

    return statements;
  }

  private collectSymbols(rawText: string, targetArray: string[]): void {
    const parts = rawText.split(',');
    for (const part of parts) {
      const clean = part.replace(/[()]/g, '').trim();
      if (!clean) continue;
      // Handle "func as f"
      const name = clean.split(/\s+as\s+/)[0].trim();
      if (name && !targetArray.includes(name)) {
        targetArray.push(name);
      }
    }
  }

  /**
   * Strips Python docstrings ("""...""" and '''...''') and # comments
   * while preserving line numbers.
   */
  private stripCommentsAndDocstrings(content: string): string {
    // Replace triple double-quotes docstrings
    let result = content.replace(/"""[\s\S]*?"""/g, (match) => {
      const lineBreaks = match.split('\n').length - 1;
      return '\n'.repeat(lineBreaks);
    });

    // Replace triple single-quotes docstrings
    result = result.replace(/'''[\s\S]*?'''/g, (match) => {
      const lineBreaks = match.split('\n').length - 1;
      return '\n'.repeat(lineBreaks);
    });

    // Replace single line comments
    result = result.replace(/#[^\n]*/g, '');

    return result;
  }
}
