/**
 * Primary navigation sections in the unified GitKit repository workspace.
 */
export type WorkspaceSection =
  'overview' | 'map' | 'diagram' | 'dependencies' | 'git' | 'pulls' | 'health' | 'security';

/**
 * Workspace navigation tab item descriptor.
 */
export interface WorkspaceNavTab {
  id: WorkspaceSection;
  label: string;
  href: string;
  badge?: string;
  badgeVariant?: 'default' | 'rose';
}
