/**
 * Canvas API Client
 * API Token = PRIMARY for all API calls
 * Cookies = SECONDARY for file downloads only
 */

import { getAuthHeaders, CookieAuth } from './auth.js';
import { cache } from './cache.js';
import { parseLinkHeader, getNextPageUrl } from './pagination.js';
import { rateLimiter } from './rate-limiter.js';
import type {
  Course,
  Assignment,
  Submission,
  Module,
  CanvasFile,
  Folder,
  Page,
  Discussion,
  Announcement,
  PlannerItem,
  Quiz,
  Rubric,
  Group,
  Bookmark,
  Conversation,
  AppointmentGroup,
  AccountNotification,
  Enrollment,
  CanvasUser,
  AssignmentBucket,
} from '../types/canvas.js';

export interface ClientConfig {
  baseUrl: string;
  apiToken?: string;
  cookiePath?: string;
  enableCache?: boolean;
}

export class CanvasClient {
  private baseUrl: string;
  private cookieAuth: CookieAuth;
  private enableCache: boolean;

  constructor(config?: Partial<ClientConfig>) {
    this.baseUrl = config?.baseUrl || process.env.CANVAS_BASE_URL || '';
    if (!this.baseUrl) {
      throw new Error('CANVAS_BASE_URL environment variable not set');
    }
    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    this.cookieAuth = new CookieAuth(config?.cookiePath);
    this.enableCache = config?.enableCache ?? true;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; linkHeader: string | null }> {
    // Rate limiting
    const acquired = await rateLimiter.acquire();
    if (!acquired) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}/api/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Canvas API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json() as T;
    const linkHeader = response.headers.get('Link');

    return { data, linkHeader };
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  async fetchAllPages<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let url = endpoint;

    // Add query params
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += (url.includes('?') ? '&' : '?') + searchParams.toString();
    }

    // Add per_page for efficiency
    if (!url.includes('per_page')) {
      url += (url.includes('?') ? '&' : '?') + 'per_page=100';
    }

    while (url) {
      const { data, linkHeader } = await this.request<T[]>(url);
      results.push(...data);

      const nextUrl = getNextPageUrl(linkHeader);
      url = nextUrl || '';
    }

    return results;
  }

  /**
   * Get with caching
   */
  private async cachedGet<T>(
    cacheKey: string,
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    if (this.enableCache) {
      const cached = cache.get<T>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += (url.includes('?') ? '&' : '?') + searchParams.toString();
    }

    const { data } = await this.request<T>(url);

    if (this.enableCache) {
      cache.set(cacheKey, data);
    }

    return data;
  }

  /**
   * Get all items with caching
   */
  private async cachedGetAll<T>(
    cacheKey: string,
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    if (this.enableCache) {
      const cached = cache.get<T[]>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const data = await this.fetchAllPages<T>(endpoint, params);

    if (this.enableCache) {
      cache.set(cacheKey, data);
    }

    return data;
  }

  // =====================
  // User & Profile
  // =====================

  async getCurrentUser(): Promise<CanvasUser> {
    return this.cachedGet<CanvasUser>('user:self', '/users/self');
  }

  async getEnrollments(): Promise<Enrollment[]> {
    return this.cachedGetAll<Enrollment>(
      'user:enrollments',
      '/users/self/enrollments',
      { 'include[]': 'current_grading_period_scores' }
    );
  }

  // =====================
  // Courses
  // =====================

  async listCourses(enrollmentState: 'active' | 'completed' | 'all' = 'active'): Promise<Course[]> {
    const params: Record<string, string> = {
      'include[]': 'total_students,term,favorites',
    };
    if (enrollmentState !== 'all') {
      params['enrollment_state'] = enrollmentState;
    }
    return this.cachedGetAll<Course>(
      `courses:${enrollmentState}`,
      '/courses',
      params
    );
  }

  async getCourse(courseId: number, includeSyllabus: boolean = false): Promise<Course> {
    const params: Record<string, string> = {
      'include[]': 'term,total_students',
    };
    if (includeSyllabus) {
      params['include[]'] += ',syllabus_body';
    }
    return this.cachedGet<Course>(
      `course:${courseId}:${includeSyllabus}`,
      `/courses/${courseId}`,
      params
    );
  }

  async getCourseProgress(courseId: number): Promise<any> {
    return this.cachedGet<any>(
      `course:${courseId}:progress`,
      `/courses/${courseId}/users/self/progress`
    );
  }

  async getCourseActivity(courseId: number): Promise<any[]> {
    return this.cachedGetAll<any>(
      `course:${courseId}:activity`,
      `/courses/${courseId}/activity_stream`
    );
  }

  async listFavorites(): Promise<Course[]> {
    return this.cachedGetAll<Course>(
      'courses:favorites',
      '/users/self/favorites/courses'
    );
  }

  // =====================
  // Assignments
  // =====================

  async listAssignments(
    courseId: number,
    bucket?: AssignmentBucket,
    orderBy: string = 'due_at',
    includeSubmission: boolean = true
  ): Promise<Assignment[]> {
    const params: Record<string, string> = {
      'order_by': orderBy,
    };
    if (includeSubmission) {
      params['include[]'] = 'submission';
    }
    if (bucket) {
      params.bucket = bucket;
    }

    return this.cachedGetAll<Assignment>(
      `course:${courseId}:assignments${bucket ? `:${bucket}` : ''}:${orderBy}`,
      `/courses/${courseId}/assignments`,
      params
    );
  }

  async getAssignment(
    courseId: number,
    assignmentId: number,
    includeRubric: boolean = false
  ): Promise<Assignment> {
    const includes = ['submission'];
    if (includeRubric) {
      includes.push('rubric_assessment');
    }
    return this.cachedGet<Assignment>(
      `assignment:${assignmentId}:${includeRubric}`,
      `/courses/${courseId}/assignments/${assignmentId}`,
      { 'include[]': includes.join(',') }
    );
  }

  async listUnsubmitted(courseId: number): Promise<Assignment[]> {
    return this.listAssignments(courseId, 'unsubmitted');
  }

  async listOverdue(courseId: number): Promise<Assignment[]> {
    return this.listAssignments(courseId, 'overdue');
  }

  async listUpcoming(courseId: number): Promise<Assignment[]> {
    return this.listAssignments(courseId, 'upcoming');
  }

  async listAssignmentGroups(courseId: number): Promise<any[]> {
    return this.cachedGetAll<any>(
      `course:${courseId}:assignment_groups`,
      `/courses/${courseId}/assignment_groups`,
      { 'include[]': 'assignments' }
    );
  }

  // =====================
  // Submissions
  // =====================

  async getMySubmission(
    courseId: number,
    assignmentId: number,
    includeRubric: boolean = false,
    includeComments: boolean = false
  ): Promise<Submission> {
    const includes: string[] = [];
    if (includeRubric) {
      includes.push('rubric_assessment');
    }
    if (includeComments) {
      includes.push('submission_comments');
    }
    const params: Record<string, string> = {};
    if (includes.length > 0) {
      params['include[]'] = includes.join(',');
    }
    return this.cachedGet<Submission>(
      `submission:${courseId}:${assignmentId}:self:${includeRubric}:${includeComments}`,
      `/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
      params
    );
  }

  async listMySubmissions(courseId: number): Promise<Submission[]> {
    return this.cachedGetAll<Submission>(
      `course:${courseId}:submissions:self`,
      `/courses/${courseId}/students/submissions`,
      {
        'student_ids[]': 'self',
        'include[]': 'submission_comments,rubric_assessment',
      }
    );
  }

  async getMissingSubmissions(): Promise<Assignment[]> {
    return this.cachedGetAll<Assignment>(
      'user:missing_submissions',
      '/users/self/missing_submissions'
    );
  }

  // =====================
  // Modules
  // =====================

  async listModules(courseId: number): Promise<Module[]> {
    return this.cachedGetAll<Module>(
      `course:${courseId}:modules`,
      `/courses/${courseId}/modules`,
      { 'include[]': 'items' }
    );
  }

  async getModule(courseId: number, moduleId: number): Promise<Module> {
    return this.cachedGet<Module>(
      `module:${moduleId}`,
      `/courses/${courseId}/modules/${moduleId}`,
      { 'include[]': 'items' }
    );
  }

  async listModuleItems(courseId: number, moduleId: number): Promise<any[]> {
    return this.cachedGetAll<any>(
      `module:${moduleId}:items`,
      `/courses/${courseId}/modules/${moduleId}/items`
    );
  }

  // =====================
  // Pages
  // =====================

  async listPages(courseId: number): Promise<Page[]> {
    return this.cachedGetAll<Page>(
      `course:${courseId}:pages`,
      `/courses/${courseId}/pages`
    );
  }

  async getPage(courseId: number, pageUrl: string): Promise<Page> {
    return this.cachedGet<Page>(
      `page:${courseId}:${pageUrl}`,
      `/courses/${courseId}/pages/${pageUrl}`
    );
  }

  // =====================
  // Files
  // =====================

  async listFiles(courseId: number): Promise<CanvasFile[]> {
    return this.cachedGetAll<CanvasFile>(
      `course:${courseId}:files`,
      `/courses/${courseId}/files`
    );
  }

  async getFile(fileId: number): Promise<CanvasFile> {
    return this.cachedGet<CanvasFile>(
      `file:${fileId}`,
      `/files/${fileId}`
    );
  }

  async listFolders(courseId: number): Promise<Folder[]> {
    return this.cachedGetAll<Folder>(
      `course:${courseId}:folders`,
      `/courses/${courseId}/folders`
    );
  }

  async searchFiles(courseId: number, searchTerm: string): Promise<CanvasFile[]> {
    // No caching for search
    return this.fetchAllPages<CanvasFile>(
      `/courses/${courseId}/files`,
      { search_term: searchTerm }
    );
  }

  /**
   * Download file (requires cookies)
   */
  async downloadFile(fileUrl: string): Promise<{ success: boolean; error?: string; data?: ArrayBuffer }> {
    if (!this.cookieAuth.isAvailable()) {
      return {
        success: false,
        error: 'Cookies required for file downloads. Export cookies from browser and set CANVAS_COOKIE_PATH.',
      };
    }

    const warning = this.cookieAuth.getWarning();
    if (warning) {
      console.warn(warning);
    }

    // Parse URL to get domain
    const urlObj = new URL(fileUrl);
    const cookieHeader = this.cookieAuth.getCookieHeader(urlObj.hostname);

    const response = await fetch(fileUrl, {
      headers: {
        'Cookie': cookieHeader,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Download failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.arrayBuffer();
    return { success: true, data };
  }

  // =====================
  // Discussions & Announcements
  // =====================

  async listAnnouncements(contextCodes: string[]): Promise<Announcement[]> {
    return this.cachedGetAll<Announcement>(
      `announcements:${contextCodes.join(',')}`,
      '/announcements',
      { 'context_codes[]': contextCodes.join(',') }
    );
  }

  async listDiscussions(courseId: number): Promise<Discussion[]> {
    return this.cachedGetAll<Discussion>(
      `course:${courseId}:discussions`,
      `/courses/${courseId}/discussion_topics`
    );
  }

  async getDiscussion(courseId: number, topicId: number): Promise<any> {
    return this.cachedGet<any>(
      `discussion:${topicId}`,
      `/courses/${courseId}/discussion_topics/${topicId}/view`
    );
  }

  // =====================
  // Planner & TODO
  // =====================

  async listPlannerItems(): Promise<PlannerItem[]> {
    return this.cachedGetAll<PlannerItem>(
      'planner:items',
      '/planner/items'
    );
  }

  async getCourseTodo(courseId: number): Promise<any[]> {
    return this.cachedGetAll<any>(
      `course:${courseId}:todo`,
      `/courses/${courseId}/todo`
    );
  }

  async getGlobalTodo(): Promise<any[]> {
    return this.cachedGetAll<any>(
      'user:todo',
      '/users/self/todo'
    );
  }

  async listUpcomingEvents(): Promise<any[]> {
    return this.cachedGetAll<any>(
      'user:upcoming_events',
      '/users/self/upcoming_events'
    );
  }

  // =====================
  // Rubrics
  // =====================

  async listRubrics(courseId: number): Promise<Rubric[]> {
    return this.cachedGetAll<Rubric>(
      `course:${courseId}:rubrics`,
      `/courses/${courseId}/rubrics`
    );
  }

  async getRubric(courseId: number, rubricId: number): Promise<Rubric> {
    return this.cachedGet<Rubric>(
      `rubric:${rubricId}`,
      `/courses/${courseId}/rubrics/${rubricId}`,
      { 'include[]': 'assessments' }
    );
  }

  // =====================
  // Quizzes
  // =====================

  async listQuizzes(courseId: number): Promise<Quiz[]> {
    return this.cachedGetAll<Quiz>(
      `course:${courseId}:quizzes`,
      `/courses/${courseId}/quizzes`
    );
  }

  async getQuiz(courseId: number, quizId: number): Promise<Quiz> {
    return this.cachedGet<Quiz>(
      `quiz:${quizId}`,
      `/courses/${courseId}/quizzes/${quizId}`
    );
  }

  async getMyQuizSubmission(courseId: number, quizId: number): Promise<any> {
    return this.cachedGet<any>(
      `quiz:${quizId}:submission:self`,
      `/courses/${courseId}/quizzes/${quizId}/submissions/self`
    );
  }

  // =====================
  // Groups
  // =====================

  async listMyGroups(): Promise<Group[]> {
    return this.cachedGetAll<Group>(
      'user:groups',
      '/users/self/groups'
    );
  }

  async getGroupMembers(groupId: number): Promise<CanvasUser[]> {
    return this.cachedGetAll<CanvasUser>(
      `group:${groupId}:members`,
      `/groups/${groupId}/users`
    );
  }

  // =====================
  // Bookmarks
  // =====================

  async listBookmarks(): Promise<Bookmark[]> {
    return this.cachedGetAll<Bookmark>(
      'user:bookmarks',
      '/users/self/bookmarks'
    );
  }

  async createBookmark(name: string, url: string): Promise<Bookmark> {
    // No caching for mutations
    const { data } = await this.request<Bookmark>('/users/self/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    });
    cache.invalidate('user:bookmarks');
    return data;
  }

  async deleteBookmark(bookmarkId: number): Promise<void> {
    await this.request(`/users/self/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
    });
    cache.invalidate('user:bookmarks');
  }

  // =====================
  // Conversations
  // =====================

  async listConversations(): Promise<Conversation[]> {
    return this.cachedGetAll<Conversation>(
      'user:conversations',
      '/conversations'
    );
  }

  async getConversation(conversationId: number): Promise<Conversation> {
    return this.cachedGet<Conversation>(
      `conversation:${conversationId}`,
      `/conversations/${conversationId}`
    );
  }

  async getUnreadMessagesCount(): Promise<{ unread_count: number }> {
    return this.cachedGet<{ unread_count: number }>(
      'user:conversations:unread',
      '/conversations/unread_count'
    );
  }

  // =====================
  // Notifications & Appointments
  // =====================

  async listAccountNotifications(accountId: number = 1): Promise<AccountNotification[]> {
    return this.cachedGetAll<AccountNotification>(
      `account:${accountId}:notifications`,
      `/accounts/${accountId}/account_notifications`
    );
  }

  async listAppointmentGroups(): Promise<AppointmentGroup[]> {
    return this.cachedGetAll<AppointmentGroup>(
      'appointment_groups',
      '/appointment_groups'
    );
  }

  // =====================
  // Cache Management
  // =====================

  clearCache(): void {
    cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return cache.stats();
  }

  // =====================
  // Cookie Status
  // =====================

  getCookieStatus(): {
    available: boolean;
    ageHours?: number;
    warning?: string;
  } {
    return {
      available: this.cookieAuth.isAvailable(),
      ageHours: this.cookieAuth.getAge(),
      warning: this.cookieAuth.getWarning(),
    };
  }
}

// Export singleton instance
let clientInstance: CanvasClient | null = null;

export function getClient(): CanvasClient {
  if (!clientInstance) {
    clientInstance = new CanvasClient();
  }
  return clientInstance;
}
