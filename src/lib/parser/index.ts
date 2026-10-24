import type { ImportStatement, PackageDependency, SourceLanguage } from '@/types/dependency';
import { JavaScriptTypeScriptParser } from './js-ts-parser';
import { PythonParser } from './python-parser';
import {
  parsePackageJson,
  parseRequirementsTxt,
  parsePyprojectToml,
  parseCargoToml,
  parseGoMod,
} from './manifest-parser';
import type { ISourceParser } from './types';

const jsTsParser = new JavaScriptTypeScriptParser();
const pythonParser = new PythonParser();

const parsers: ISourceParser[] = [jsTsParser, pythonParser];

/**
 * Returns the detected programming language for a given file path.
 */
export function getLanguageForFile(filePath: string): SourceLanguage {
  if (jsTsParser.canParse(filePath)) {
    return jsTsParser.getSpecificLanguage(filePath);
  }
  if (pythonParser.canParse(filePath)) {
    return 'python';
  }
  return 'unsupported';
}

/**
 * Determines whether a file path has an enabled source code parser.
 */
export function isSupportedSourceFile(filePath: string): boolean {
  return parsers.some((p) => p.canParse(filePath));
}

/**
 * Deterministically extracts all import statements from source code.
 */
export function parseSourceImports(filePath: string, content: string): ImportStatement[] {
  for (const parser of parsers) {
    if (parser.canParse(filePath)) {
      return parser.extractImports(content, filePath);
    }
  }
  return [];
}

/**
 * Determines whether a file is a recognized dependency manifest.
 */
export function isManifestFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  return ['package.json', 'requirements.txt', 'pyproject.toml', 'cargo.toml', 'go.mod'].includes(
    fileName
  );
}

/**
 * Parses package dependencies from a recognized project manifest.
 */
export function parseManifest(filePath: string, content: string): PackageDependency[] {
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  switch (fileName) {
    case 'package.json':
      return parsePackageJson(content, filePath);
    case 'requirements.txt':
      return parseRequirementsTxt(content, filePath);
    case 'pyproject.toml':
      return parsePyprojectToml(content, filePath);
    case 'cargo.toml':
      return parseCargoToml(content, filePath);
    case 'go.mod':
      return parseGoMod(content, filePath);
    default:
      return [];
  }
}
