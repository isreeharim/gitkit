/**
 * File category classification.
 */
export type FileCategory =
  'source' | 'markup' | 'data' | 'config' | 'documentation' | 'asset' | 'binary';

export interface LanguageDefinition {
  readonly name: string;
  readonly color: string;
  readonly category: FileCategory;
  readonly extensions: readonly string[];
  readonly filenames?: readonly string[];
}

/**
 * Deterministic database of programming, markup, and data languages.
 * Canonical colors align with GitHub's open Linguist repository database.
 */
export const LANGUAGE_REGISTRY: readonly LanguageDefinition[] = [
  // Primary Programming Languages
  {
    name: 'TypeScript',
    color: '#3178c6',
    category: 'source',
    extensions: ['.ts', '.mts', '.cts'],
  },
  {
    name: 'TSX',
    color: '#2b7489',
    category: 'source',
    extensions: ['.tsx'],
  },
  {
    name: 'JavaScript',
    color: '#f1e05a',
    category: 'source',
    extensions: ['.js', '.mjs', '.cjs'],
  },
  {
    name: 'JSX',
    color: '#e7bf2a',
    category: 'source',
    extensions: ['.jsx'],
  },
  {
    name: 'Python',
    color: '#3572A5',
    category: 'source',
    extensions: ['.py', '.pyi', '.pyw'],
  },
  {
    name: 'Rust',
    color: '#dea584',
    category: 'source',
    extensions: ['.rs'],
  },
  {
    name: 'Go',
    color: '#00ADD8',
    category: 'source',
    extensions: ['.go'],
  },
  {
    name: 'Java',
    color: '#b07219',
    category: 'source',
    extensions: ['.java', '.jar'],
  },
  {
    name: 'C',
    color: '#555555',
    category: 'source',
    extensions: ['.c', '.h'],
  },
  {
    name: 'C++',
    color: '#f34b7d',
    category: 'source',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  },
  {
    name: 'C#',
    color: '#178600',
    category: 'source',
    extensions: ['.cs'],
  },
  {
    name: 'Ruby',
    color: '#701516',
    category: 'source',
    extensions: ['.rb', '.rake', '.gemspec'],
    filenames: ['Gemfile', 'Rakefile'],
  },
  {
    name: 'PHP',
    color: '#4F5D95',
    category: 'source',
    extensions: ['.php', '.phtml'],
  },
  {
    name: 'Swift',
    color: '#F05138',
    category: 'source',
    extensions: ['.swift'],
  },
  {
    name: 'Kotlin',
    color: '#A97BFF',
    category: 'source',
    extensions: ['.kt', '.kts'],
  },
  {
    name: 'Scala',
    color: '#c22d40',
    category: 'source',
    extensions: ['.scala', '.sc'],
  },
  {
    name: 'Shell',
    color: '#89e051',
    category: 'source',
    extensions: ['.sh', '.bash', '.zsh'],
  },
  {
    name: 'PowerShell',
    color: '#012456',
    category: 'source',
    extensions: ['.ps1', '.psm1'],
  },
  {
    name: 'Lua',
    color: '#000080',
    category: 'source',
    extensions: ['.lua'],
  },
  {
    name: 'SQL',
    color: '#e38c00',
    category: 'source',
    extensions: ['.sql'],
  },
  {
    name: 'R',
    color: '#198CE7',
    category: 'source',
    extensions: ['.r', '.R'],
  },
  {
    name: 'Dart',
    color: '#00B4AB',
    category: 'source',
    extensions: ['.dart'],
  },
  // Web Frameworks & UI Languages
  {
    name: 'Astro',
    color: '#ff5a03',
    category: 'source',
    extensions: ['.astro'],
  },
  {
    name: 'Vue',
    color: '#41b883',
    category: 'source',
    extensions: ['.vue'],
  },
  {
    name: 'Svelte',
    color: '#ff3e00',
    category: 'source',
    extensions: ['.svelte'],
  },
  {
    name: 'HTML',
    color: '#e34c26',
    category: 'markup',
    extensions: ['.html', '.htm'],
  },
  {
    name: 'CSS',
    color: '#563d7c',
    category: 'markup',
    extensions: ['.css'],
  },
  {
    name: 'SCSS',
    color: '#c6538c',
    category: 'markup',
    extensions: ['.scss', '.sass'],
  },
  // Data, Config, Documentation
  {
    name: 'Markdown',
    color: '#083fa1',
    category: 'documentation',
    extensions: ['.md', '.markdown', '.mdown', '.mdx'],
  },
  {
    name: 'JSON',
    color: '#292929',
    category: 'data',
    extensions: ['.json', '.json5', '.jsonc'],
  },
  {
    name: 'YAML',
    color: '#cb171e',
    category: 'data',
    extensions: ['.yaml', '.yml'],
  },
  {
    name: 'TOML',
    color: '#9c4221',
    category: 'config',
    extensions: ['.toml'],
  },
  {
    name: 'XML',
    color: '#0060ac',
    category: 'data',
    extensions: ['.xml', '.svg'],
  },
  {
    name: 'Dockerfile',
    color: '#384d54',
    category: 'config',
    extensions: ['.dockerfile'],
    filenames: ['Dockerfile', 'dockerfile', 'Containerfile'],
  },
  {
    name: 'Makefile',
    color: '#427819',
    category: 'config',
    extensions: ['.mk', '.mak'],
    filenames: ['Makefile', 'makefile', 'GNUmakefile'],
  },
];

// Pre-indexed lookup maps for O(1) matching
const EXTENSION_MAP = new Map<string, LanguageDefinition>();
const FILENAME_MAP = new Map<string, LanguageDefinition>();

for (const lang of LANGUAGE_REGISTRY) {
  for (const ext of lang.extensions) {
    EXTENSION_MAP.set(ext.toLowerCase(), lang);
  }
  if (lang.filenames) {
    for (const fn of lang.filenames) {
      FILENAME_MAP.set(fn.toLowerCase(), lang);
    }
  }
}

/**
 * Deterministically detects the language of a given file path based on its name and extension.
 */
export function detectLanguage(filePath: string): LanguageDefinition | null {
  const fileName = filePath.split('/').pop() || '';
  const lowerFileName = fileName.toLowerCase();

  // 1. Exact filename match (e.g. Dockerfile, Makefile, Gemfile)
  const exactMatch = FILENAME_MAP.get(lowerFileName);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. Extension match
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = fileName.slice(dotIndex).toLowerCase();
    const extMatch = EXTENSION_MAP.get(ext);
    if (extMatch) {
      return extMatch;
    }
  }

  return null;
}

/**
 * Checks if a file path is considered a primary source code file.
 */
export function isSourceCodeFile(filePath: string): boolean {
  const lang = detectLanguage(filePath);
  return lang !== null && lang.category === 'source';
}

/**
 * Gets the standard file extension or an empty string.
 */
export function getFileExtension(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex !== -1 ? fileName.slice(dotIndex).toLowerCase() : '';
}
