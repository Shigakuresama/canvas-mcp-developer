/**
 * Course Tools
 * Tools for interacting with Canvas courses
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register course-related tools
 */
export function registerCourseTools(): Tool[] {
  return [
    {
      name: 'canvas_course_list',
      description: `List all courses for the current user. Returns active courses by default.

Use this to:
- Get an overview of enrolled courses
- Find course IDs for other operations
- Check enrollment status`,
      inputSchema: {
        type: 'object',
        properties: {
          enrollment_state: {
            type: 'string',
            enum: ['active', 'completed', 'all'],
            description: 'Filter by enrollment state. Default: active',
          },
          include_favorites: {
            type: 'boolean',
            description: 'Include favorite status in response',
          },
        },
      },
    },
    {
      name: 'canvas_course_get',
      description: `Get detailed information about a specific course.

Returns:
- Course name, code, term
- Start/end dates
- Syllabus (if requested)
- Total students count`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          include_syllabus: {
            type: 'boolean',
            description: 'Include syllabus body in response',
          },
        },
        required: ['course_id'],
      },
    },
  ];
}

/**
 * Handle course tool calls
 */
export async function handleCourseTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_course_list':
      return await listCourses(client, args);

    case 'canvas_course_get':
      return await getCourse(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown course tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List courses for current user
 */
async function listCourses(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const enrollmentState = (args?.enrollment_state as string) || 'active';
  const includeFavorites = args?.include_favorites as boolean;

  const courses = await client.listCourses(enrollmentState as 'active' | 'completed' | 'all');

  if (courses.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No ${enrollmentState} courses found.`,
        },
      ],
    };
  }

  // Format course list
  const courseList = courses.map((course) => {
    let info = `**${course.name}** (ID: ${course.id})`;
    if (course.course_code) {
      info += `\n  Code: ${course.course_code}`;
    }
    if (course.term?.name) {
      info += `\n  Term: ${course.term.name}`;
    }
    if (includeFavorites && course.is_favorite) {
      info += `\n  ⭐ Favorite`;
    }
    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `Found ${courses.length} ${enrollmentState} courses:\n\n${courseList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * Get detailed course information
 */
async function getCourse(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const includeSyllabus = args?.include_syllabus as boolean;

  if (!courseId) {
    return {
      content: [{ type: 'text', text: 'course_id is required' }],
      isError: true,
    };
  }

  const course = await client.getCourse(courseId, includeSyllabus);

  // Format course details
  let details = `# ${course.name}\n\n`;
  details += `**Course ID:** ${course.id}\n`;

  if (course.course_code) {
    details += `**Course Code:** ${course.course_code}\n`;
  }

  if (course.term?.name) {
    details += `**Term:** ${course.term.name}\n`;
  }

  if (course.start_at) {
    details += `**Start Date:** ${new Date(course.start_at).toLocaleDateString()}\n`;
  }

  if (course.end_at) {
    details += `**End Date:** ${new Date(course.end_at).toLocaleDateString()}\n`;
  }

  if (course.total_students !== undefined) {
    details += `**Total Students:** ${course.total_students}\n`;
  }

  if (course.workflow_state) {
    details += `**Status:** ${course.workflow_state}\n`;
  }

  if (includeSyllabus && course.syllabus_body) {
    details += `\n## Syllabus\n\n${course.syllabus_body}`;
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}
