import { detectLanguage } from './language-detector';

export interface FileLocCounts {
  readonly totalLines: number;
  readonly codeLines: number;
  readonly commentLines: number;
  readonly blankLines: number;
}

type CommentSyntaxStyle =
  | 'c-style' // // and /* */
  | 'hash-style' // # and """/'''
  | 'html-style' // <!-- -->
  | 'sql-style' // -- and /* */
  | 'css-style' // /* */
  | 'none';

function getCommentSyntaxStyle(filePath: string): CommentSyntaxStyle {
  const lang = detectLanguage(filePath);
  if (!lang) return 'c-style'; // default fallback

  switch (lang.name) {
    case 'JavaScript':
    case 'TypeScript':
    case 'JSX':
    case 'TSX':
    case 'C':
    case 'C++':
    case 'C#':
    case 'Java':
    case 'Rust':
    case 'Go':
    case 'Swift':
    case 'Kotlin':
    case 'Scala':
    case 'PHP':
    case 'Dart':
      return 'c-style';

    case 'Python':
    case 'Ruby':
    case 'Shell':
    case 'PowerShell':
    case 'YAML':
    case 'TOML':
    case 'Dockerfile':
    case 'Makefile':
    case 'R':
      return 'hash-style';

    case 'HTML':
    case 'Markdown':
    case 'XML':
    case 'Astro':
    case 'Vue':
    case 'Svelte':
      return 'html-style';

    case 'SQL':
    case 'Lua':
      return 'sql-style';

    case 'CSS':
    case 'SCSS':
      return 'css-style';

    default:
      return 'none';
  }
}

/**
 * Deterministically analyzes source code string to compute lines of code,
 * comment lines, and blank lines.
 */
export function countLinesOfCode(content: string, filePath: string): FileLocCounts {
  if (!content) {
    return {
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
    };
  }

  const lines = content.split('\n');
  const totalLines = lines.length;
  let blankLines = 0;
  let pureCommentLines = 0;
  let inBlockComment = false;
  let blockCommentDelimiter = '';

  const style = getCommentSyntaxStyle(filePath);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // 1. Blank line check
    if (trimmed.length === 0) {
      blankLines++;
      continue;
    }

    // 2. Currently inside a multiline block comment
    if (inBlockComment) {
      pureCommentLines++;
      if (style === 'c-style' || style === 'css-style' || style === 'sql-style') {
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
      } else if (style === 'html-style') {
        if (trimmed.includes('-->')) {
          inBlockComment = false;
        }
      } else if (style === 'hash-style') {
        if (trimmed.includes(blockCommentDelimiter)) {
          inBlockComment = false;
          blockCommentDelimiter = '';
        }
      }
      continue;
    }

    // 3. Check for starting of multiline block comment or single-line comment
    if (style === 'c-style') {
      if (trimmed.startsWith('//')) {
        pureCommentLines++;
        continue;
      }
      if (trimmed.startsWith('/*')) {
        pureCommentLines++;
        if (!trimmed.includes('*/') || trimmed.indexOf('*/') === 0) {
          inBlockComment = true;
        }
        continue;
      }
    } else if (style === 'hash-style') {
      if (trimmed.startsWith('#')) {
        pureCommentLines++;
        continue;
      }
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        pureCommentLines++;
        const delim = trimmed.startsWith('"""') ? '"""' : "'''";
        // Check if docstring opens and closes on same line
        if (trimmed.length > 3 && trimmed.slice(3).includes(delim)) {
          // Closed on same line
        } else {
          inBlockComment = true;
          blockCommentDelimiter = delim;
        }
        continue;
      }
    } else if (style === 'html-style') {
      if (trimmed.startsWith('<!--')) {
        pureCommentLines++;
        if (!trimmed.includes('-->')) {
          inBlockComment = true;
        }
        continue;
      }
    } else if (style === 'sql-style') {
      if (trimmed.startsWith('--')) {
        pureCommentLines++;
        continue;
      }
      if (trimmed.startsWith('/*')) {
        pureCommentLines++;
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
        continue;
      }
    } else if (style === 'css-style') {
      if (trimmed.startsWith('/*')) {
        pureCommentLines++;
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
        continue;
      }
    }
  }

  const codeLines = Math.max(0, totalLines - blankLines - pureCommentLines);

  return {
    totalLines,
    codeLines,
    commentLines: pureCommentLines,
    blankLines,
  };
}
