export interface Workspace {
  id: string;
  title: string;
  path: string;
  color: string;
  runningSessions: number;
  hasNotifications: boolean;
  worktreeEnabled: boolean;
  status: 'active' | 'archived';
  startupScript?: string | null;
}

export interface WorkspaceSession {
  id: string;
  workspaceId: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  type: 'local' | 'worktree';
  worktreeBranch?: string;
}
