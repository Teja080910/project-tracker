export type Role = 'super_admin' | 'project_admin' | 'developer' | 'tester' | 'viewer';
export type ProjectStatus = 'active' | 'completed' | 'archived';
export type VersionStatus = 'active' | 'released' | 'archived';
export type TaskType = 'task' | 'bug' | 'story' | 'issue';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  client_name: string | null;
  status: ProjectStatus;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: Role;
  created_at: string;
  profile?: Profile;
}

export interface Version {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  description: string | null;
  release_date: string | null;
  status: VersionStatus;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  number: number;
  project_id: string;
  version_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  reporter_id: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  project?: Project;
  version?: Version;
  assignee?: Profile | null;
  reporter?: Profile;
  tags?: Tag[];
}

export interface TaskImage {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  project_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile | null;
  project?: Project | null;
}

export interface ActivityLog {
  id: string;
  project_id: string | null;
  task_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profile?: Profile;
}
