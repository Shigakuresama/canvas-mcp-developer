/**
 * Dashboard Tools
 * Tools for Canvas dashboard and user profile
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register dashboard-related tools
 */
export function registerDashboardTools(): Tool[] {
  return [
    {
      name: 'canvas_dashboard',
      description: `Get a comprehensive dashboard view of your Canvas activity.

Aggregates:
- Upcoming assignments (next 7 days)
- Missing submissions
- Unread messages
- Recent announcements
- Course favorites

This is the best starting point for a study session.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_profile',
      description: `Get your Canvas user profile.

Returns:
- Your name and email
- Profile settings
- Avatar URL`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_grades_overview',
      description: `Get an overview of your grades across all courses.

Returns:
- Current grade in each course
- Final grade if available
- GPA calculation help`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_cache_status',
      description: `Get cache status and statistics.

Shows:
- Number of cached items
- Cache keys
- Useful for debugging`,
      inputSchema: {
        type: 'object',
        properties: {
          clear: {
            type: 'boolean',
            description: 'Clear the cache',
          },
        },
      },
    },
  ];
}

/**
 * Handle dashboard tool calls
 */
export async function handleDashboardTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_dashboard':
      return await getDashboard(client, args);

    case 'canvas_profile':
      return await getProfile(client, args);

    case 'canvas_grades_overview':
      return await getGradesOverview(client, args);

    case 'canvas_cache_status':
      return await getCacheStatus(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown dashboard tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * Get dashboard overview
 */
async function getDashboard(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Gather data from multiple sources
  const [user, plannerItems, missing, unreadCount, favorites] = await Promise.all([
    client.getCurrentUser(),
    client.listPlannerItems(),
    client.getMissingSubmissions(),
    client.getUnreadMessagesCount(),
    client.listFavorites().catch(() => []),
  ]);

  let output = `# Dashboard for ${user.name}\n\n`;
  output += `*${new Date().toLocaleString()}*\n\n`;

  // Unread messages
  if (unreadCount.unread_count > 0) {
    output += `## 📬 Unread Messages: ${unreadCount.unread_count}\n\n`;
  }

  // Missing submissions (urgent!)
  if (missing.length > 0) {
    output += `## ⚠️ Missing Submissions: ${missing.length}\n\n`;
    const topMissing = missing.slice(0, 5);
    for (const a of topMissing) {
      output += `- **${a.name}** (${a.points_possible || 0} pts)`;
      if (a.due_at) {
        const daysLate = Math.floor((Date.now() - new Date(a.due_at).getTime()) / (1000 * 60 * 60 * 24));
        output += ` - ${daysLate} days late`;
      }
      output += '\n';
    }
    if (missing.length > 5) {
      output += `\n*...and ${missing.length - 5} more*\n`;
    }
    output += '\n';
  }

  // Upcoming items (next 7 days)
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming = plannerItems.filter((item) => {
    if (!item.plannable_date) return false;
    const date = new Date(item.plannable_date);
    return date >= now && date <= weekFromNow;
  });

  if (upcoming.length > 0) {
    output += `## 📅 Due This Week: ${upcoming.length} items\n\n`;

    // Group by day
    const byDay = new Map<string, typeof upcoming>();
    for (const item of upcoming) {
      const day = new Date(item.plannable_date!).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(item);
    }

    for (const [day, items] of byDay) {
      output += `**${day}:**\n`;
      for (const item of items) {
        const submitted = item.submissions?.submitted ? '✓' : '○';
        output += `  ${submitted} ${item.plannable.title} (${item.context_name})\n`;
      }
    }
    output += '\n';
  } else {
    output += `## 📅 Nothing due this week! 🎉\n\n`;
  }

  // Favorite courses
  if (favorites.length > 0) {
    output += `## ⭐ Favorite Courses\n\n`;
    for (const course of favorites) {
      output += `- ${course.name}\n`;
    }
    output += '\n';
  }

  // Quick stats
  output += `---\n\n`;
  output += `**Quick Actions:**\n`;
  output += `- Use \`canvas_missing_submissions\` for full missing list\n`;
  output += `- Use \`canvas_planner_items\` for detailed planner\n`;
  output += `- Use \`canvas_inbox_list\` to check messages\n`;

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Get user profile
 */
async function getProfile(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const user = await client.getCurrentUser();

  let output = `# Your Profile\n\n`;
  output += `**Name:** ${user.name}\n`;

  if (user.short_name && user.short_name !== user.name) {
    output += `**Short Name:** ${user.short_name}\n`;
  }

  if (user.sortable_name) {
    output += `**Sortable Name:** ${user.sortable_name}\n`;
  }

  if (user.email) {
    output += `**Email:** ${user.email}\n`;
  }

  if (user.login_id) {
    output += `**Login ID:** ${user.login_id}\n`;
  }

  output += `**User ID:** ${user.id}\n`;
  output += `**Created:** ${new Date(user.created_at).toLocaleDateString()}\n`;

  if (user.avatar_url) {
    output += `\n**Avatar URL:** ${user.avatar_url}\n`;
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Get grades overview
 */
async function getGradesOverview(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const enrollments = await client.getEnrollments();

  // Filter to student enrollments with grades
  const studentEnrollments = enrollments.filter(
    (e) => e.type === 'StudentEnrollment' && e.grades
  );

  if (studentEnrollments.length === 0) {
    return {
      content: [{ type: 'text', text: 'No grade information available.' }],
    };
  }

  let output = `# Grades Overview\n\n`;

  // Group by course
  for (const enrollment of studentEnrollments) {
    output += `## Course ${enrollment.course_id}\n`;

    const grades = enrollment.grades;
    if (grades) {
      if (grades.current_score !== undefined) {
        output += `**Current Score:** ${grades.current_score}%`;
        if (grades.current_grade) {
          output += ` (${grades.current_grade})`;
        }
        output += '\n';
      }

      if (grades.final_score !== undefined) {
        output += `**Final Score:** ${grades.final_score}%`;
        if (grades.final_grade) {
          output += ` (${grades.final_grade})`;
        }
        output += '\n';
      }
    }

    // Also check computed scores
    if (enrollment.computed_current_score !== undefined) {
      output += `**Computed Current:** ${enrollment.computed_current_score}%`;
      if (enrollment.computed_current_grade) {
        output += ` (${enrollment.computed_current_grade})`;
      }
      output += '\n';
    }

    output += '\n';
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Get cache status
 */
async function getCacheStatus(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const clearCache = args?.clear as boolean;

  if (clearCache) {
    client.clearCache();
    return {
      content: [{ type: 'text', text: 'Cache cleared successfully.' }],
    };
  }

  const stats = client.getCacheStats();
  const cookieStatus = client.getCookieStatus();

  let output = `# Cache Status\n\n`;
  output += `**Cached Items:** ${stats.size}\n`;

  if (stats.keys.length > 0) {
    output += `\n**Cached Keys:**\n`;
    for (const key of stats.keys.slice(0, 20)) {
      output += `- ${key}\n`;
    }
    if (stats.keys.length > 20) {
      output += `\n*...and ${stats.keys.length - 20} more*\n`;
    }
  }

  output += `\n## Cookie Status\n\n`;
  output += `**Available:** ${cookieStatus.available ? 'Yes' : 'No'}\n`;

  if (cookieStatus.ageHours !== undefined) {
    output += `**Age:** ${Math.round(cookieStatus.ageHours)} hours\n`;
  }

  if (cookieStatus.warning) {
    output += `\n⚠️ ${cookieStatus.warning}\n`;
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}
