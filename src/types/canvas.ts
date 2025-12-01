/**
 * Canvas LMS API Types
 * Based on official Instructure documentation
 */

// Base types
export interface CanvasUser {
  id: number;
  name: string;
  sortable_name: string;
  short_name: string;
  login_id?: string;
  email?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
  workflow_state: 'available' | 'unpublished' | 'completed' | 'deleted';
  account_id: number;
  enrollment_term_id: number;
  start_at?: string;
  end_at?: string;
  syllabus_body?: string;
  default_view: string;
  enrollments?: Enrollment[];
  total_students?: number;
  time_zone?: string;
  term?: {
    id: number;
    name: string;
    start_at?: string;
    end_at?: string;
  };
  is_favorite?: boolean;
}

export interface Enrollment {
  id: number;
  course_id: number;
  user_id: number;
  type: 'StudentEnrollment' | 'TeacherEnrollment' | 'TaEnrollment' | 'DesignerEnrollment' | 'ObserverEnrollment';
  enrollment_state: 'active' | 'invited' | 'inactive' | 'completed' | 'deleted';
  computed_current_score?: number;
  computed_final_score?: number;
  computed_current_grade?: string;
  computed_final_grade?: string;
  grades?: {
    current_score?: number;
    final_score?: number;
    current_grade?: string;
    final_grade?: string;
  };
}

export interface Assignment {
  id: number;
  name: string;
  description?: string;
  course_id: number;
  created_at: string;
  updated_at: string;
  due_at?: string;
  lock_at?: string;
  unlock_at?: string;
  points_possible: number;
  grading_type: 'pass_fail' | 'percent' | 'letter_grade' | 'gpa_scale' | 'points' | 'not_graded';
  assignment_group_id: number;
  submission_types: SubmissionType[];
  has_submitted_submissions: boolean;
  workflow_state: 'published' | 'unpublished' | 'deleted';
  rubric?: RubricCriterion[];
  rubric_settings?: RubricSettings;
  submission?: Submission;
  allowed_extensions?: string[];
}

export type SubmissionType =
  | 'online_text_entry'
  | 'online_url'
  | 'online_upload'
  | 'media_recording'
  | 'student_annotation'
  | 'external_tool'
  | 'on_paper'
  | 'none';

export interface AssignmentGroup {
  id: number;
  name: string;
  position: number;
  group_weight: number;
  assignments?: Assignment[];
}

export interface Submission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at?: string;
  graded_at?: string;
  score?: number;
  grade?: string;
  workflow_state: string; // Can have various states beyond the strict enum
  late: boolean;
  missing: boolean;
  excused: boolean;
  submission_type?: SubmissionType;
  body?: string;
  url?: string;
  preview_url?: string;
  attachments?: Attachment[];
  submission_comments?: SubmissionComment[];
  rubric_assessment?: Record<string, RubricAssessment>;
  attempt?: number;
}

export interface SubmissionComment {
  id: number;
  author_id: number;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface RubricCriterion {
  id: string;
  description: string;
  long_description?: string;
  points: number;
  ratings: RubricRating[];
}

export interface RubricRating {
  id: string;
  description: string;
  long_description?: string;
  points: number;
}

export interface RubricSettings {
  points_possible: number;
  free_form_criterion_comments: boolean;
}

export interface RubricAssessment {
  points: number;
  rating_id?: string;
  comments?: string;
}

export interface Rubric {
  id: number;
  title: string;
  context_id: number;
  context_type: string;
  points_possible: number;
  data: RubricCriterion[];
}

export interface Module {
  id: number;
  name: string;
  position: number;
  unlock_at?: string;
  require_sequential_progress: boolean;
  publish_final_grade: boolean;
  prerequisite_module_ids: number[];
  state: 'locked' | 'unlocked' | 'started' | 'completed';
  completed_at?: string;
  items_count: number;
  items_url: string;
  items?: ModuleItem[];
}

export interface ModuleItem {
  id: number;
  module_id: number;
  position: number;
  title: string;
  type: 'File' | 'Page' | 'Discussion' | 'Assignment' | 'Quiz' | 'SubHeader' | 'ExternalUrl' | 'ExternalTool';
  content_id?: number;
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  completion_requirement?: {
    type: 'must_view' | 'must_submit' | 'must_contribute' | 'min_score';
    min_score?: number;
    completed?: boolean;
  };
}

export interface CanvasFile {
  id: number;
  uuid: string;
  folder_id: number;
  display_name: string;
  filename: string;
  'content-type': string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string;
}

export interface Folder {
  id: number;
  name: string;
  full_name: string;
  context_id: number;
  context_type: string;
  parent_folder_id?: number;
  created_at: string;
  updated_at: string;
  files_count: number;
  folders_count: number;
}

export interface Page {
  page_id: number;
  url: string;
  title: string;
  body?: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  front_page: boolean;
}

export interface Discussion {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  last_reply_at?: string;
  discussion_type: 'side_comment' | 'threaded';
  published: boolean;
  locked: boolean;
  pinned: boolean;
  user_name: string;
  unread_count: number;
}

export interface DiscussionEntry {
  id: number;
  user_id: number;
  user_name: string;
  message: string;
  created_at: string;
  updated_at: string;
  replies?: DiscussionEntry[];
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  context_code: string;
  user_name: string;
}

export interface PlannerItem {
  plannable_id: number;
  plannable_type: 'assignment' | 'quiz' | 'discussion_topic' | 'wiki_page' | 'announcement' | 'planner_note' | 'calendar_event';
  plannable_date?: string;
  planner_override?: {
    dismissed: boolean;
    marked_complete: boolean;
  };
  submissions?: {
    submitted: boolean;
    excused: boolean;
    graded: boolean;
  };
  context_name: string;
  context_type: string;
  plannable: {
    id: number;
    title: string;
    due_at?: string;
    points_possible?: number;
  };
}

export interface Quiz {
  id: number;
  title: string;
  description?: string;
  quiz_type: 'practice_quiz' | 'assignment' | 'graded_survey' | 'survey';
  points_possible: number;
  due_at?: string;
  lock_at?: string;
  unlock_at?: string;
  published: boolean;
  question_count: number;
  time_limit?: number;
  allowed_attempts: number;
}

export interface QuizSubmission {
  id: number;
  quiz_id: number;
  user_id: number;
  submission_id: number;
  started_at: string;
  finished_at?: string;
  end_at?: string;
  attempt: number;
  score?: number;
  kept_score?: number;
  workflow_state: 'untaken' | 'pending_review' | 'complete' | 'settings_only' | 'preview';
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  context_type: string;
  course_id?: number;
  members_count: number;
}

export interface Bookmark {
  id: number;
  name: string;
  url: string;
  position: number;
}

export interface Conversation {
  id: number;
  subject: string;
  workflow_state: 'read' | 'unread' | 'archived';
  last_message: string;
  last_message_at: string;
  message_count: number;
  subscribed: boolean;
  starred: boolean;
  participants: { id: number; name: string }[];
  messages?: ConversationMessage[];
}

export interface ConversationMessage {
  id: number;
  created_at: string;
  body: string;
  author_id: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  uuid: string;
  display_name: string;
  filename: string;
  'content-type': string;
  url: string;
  size: number;
}

export interface AppointmentGroup {
  id: number;
  title: string;
  context_codes: string[];
  sub_context_codes: string[];
  workflow_state: 'pending' | 'active' | 'deleted';
  start_at?: string;
  end_at?: string;
  participant_visibility: 'protected' | 'private';
  appointments_count: number;
  max_appointments_per_participant?: number;
}

export interface AccountNotification {
  id: number;
  subject: string;
  message: string;
  start_at: string;
  end_at: string;
  icon: 'warning' | 'information' | 'question' | 'error' | 'calendar';
}

export interface ContentExport {
  id: number;
  created_at: string;
  export_type: string;
  attachment?: {
    url: string;
  };
  progress_url: string;
  workflow_state: 'created' | 'exporting' | 'exported' | 'failed';
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  nextPage?: string;
}

export interface CanvasError {
  errors: Array<{
    message: string;
    error_code?: string;
  }>;
  status: string;
}

// Assignment bucket filter types
export type AssignmentBucket =
  | 'past'
  | 'overdue'
  | 'undated'
  | 'unsubmitted'
  | 'upcoming'
  | 'future';
