import { describe, it, expect } from 'vitest';
import {
  escapeMermaidText,
  sanitizeMermaidId,
  compileDiagramToMermaid,
} from '@/lib/diagram/mermaid-compiler';
import type { DiagramGraph } from '@/types/diagram';

describe('Mermaid Compiler', () => {
  describe('escapeMermaidText', () => {
    it('escapes hash, quotes, backticks, and brackets to prevent syntax errors', () => {
      const input = 'My "Component" #item `code` [test] {config} (call) & <tag>';
      const escaped = escapeMermaidText(input);

      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain(' #item');
      expect(escaped).toContain('&#35;item');
      expect(escaped).not.toContain('`');
      expect(escaped).not.toContain('[test]');
      expect(escaped).not.toContain('{config}');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#96;');
      expect(escaped).toContain('&#91;test&#93;');
      expect(escaped).toContain('&#123;config&#125;');
    });

    it('returns Unnamed if given an empty or whitespace string', () => {
      expect(escapeMermaidText('')).toBe('Unnamed');
      expect(escapeMermaidText('   ')).toBe('Unnamed');
    });
  });

  describe('sanitizeMermaidId', () => {
    it('replaces non-alphanumeric characters with underscores', () => {
      expect(sanitizeMermaidId('src/components/App.tsx')).toBe('src_components_App_tsx');
      expect(sanitizeMermaidId('---invalid-id')).toBe('invalid_id');
    });
  });

  describe('compileDiagramToMermaid', () => {
    const mockGraph: DiagramGraph = {
      groups: [
        { id: 'client', label: 'Client Layer', description: null },
        { id: 'storage', label: 'Data Layer', description: null },
      ],
      nodes: [
        {
          id: 'node_app',
          label: 'App Component',
          type: 'UI / Component',
          groupId: 'client',
          path: 'src/App.tsx',
          shape: 'box',
          tone: 'toneBlue',
        },
        {
          id: 'node_db',
          label: 'Postgres Client',
          type: 'Data Store',
          groupId: 'storage',
          path: 'src/db.ts',
          shape: 'database',
          tone: 'toneAmber',
        },
        {
          id: 'node_ext',
          label: 'External API',
          type: 'Third Party',
          groupId: null,
          path: null,
          shape: 'circle',
          tone: 'toneTeal',
        },
      ],
      edges: [
        {
          id: 'e1',
          from: 'node_app',
          to: 'node_db',
          label: 'persists',
          style: 'solid',
        },
        {
          id: 'e2',
          from: 'node_app',
          to: 'node_ext',
          label: 'calls',
          style: 'dashed',
        },
      ],
      summary: {
        totalComponents: 3,
        subsystemsCount: 2,
        relationshipsCount: 2,
        primaryLanguage: 'TypeScript',
      },
    };

    it('generates valid flowchart TD Mermaid syntax with subgraphs, shapes, and classDefs', () => {
      const mermaidCode = compileDiagramToMermaid(mockGraph, {
        owner: 'octocat',
        repo: 'Hello-World',
        defaultBranch: 'main',
      });

      expect(mermaidCode).toContain('flowchart TD');
      expect(mermaidCode).toContain('subgraph group_client["Client Layer"]');
      expect(mermaidCode).toContain('subgraph group_storage["Data Layer"]');
      expect(mermaidCode).toContain(
        'node_app["App Component<br/><small>[UI / Component]</small>"]'
      );
      expect(mermaidCode).toContain('node_db[("Postgres Client<br/><small>[Data Store]</small>")]');
      expect(mermaidCode).toContain('node_ext(("External API<br/><small>[Third Party]</small>"))');
      expect(mermaidCode).toContain('node_app -->|"persists"| node_db');
      expect(mermaidCode).toContain('node_app -.->|"calls"| node_ext');

      // Click directives
      expect(mermaidCode).toContain(
        'click node_app "https://github.com/octocat/Hello-World/blob/main/src/App.tsx"'
      );
      expect(mermaidCode).toContain(
        'click node_db "https://github.com/octocat/Hello-World/blob/main/src/db.ts"'
      );

      // Class definitions and assignments
      expect(mermaidCode).toContain('classDef toneBlue');
      expect(mermaidCode).toContain('classDef toneAmber');
      expect(mermaidCode).toContain('class node_app toneBlue');
      expect(mermaidCode).toContain('class node_db toneAmber');
      expect(mermaidCode).toContain('class node_ext toneTeal');
    });
  });
});
