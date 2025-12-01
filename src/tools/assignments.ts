/**
 * Assignment Tools
 * Tools for interacting with Canvas assignments and submissions
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';
import type { AssignmentBucket } from '../types/canvas.js';

/**
 * Register assignment-related tools
 */
export function registerAssignmentTools(): Tool[] {
  return [
    {
      name: 'canvas_assignment_list',
      description: `List assignments in a course with optional filtering.

Bucket filters:
- past: Already due
- overdue: Past due, not submitted
- undated: No due date
- unsubmitted: Not yet submitted
- upcoming: Due soon
- future: Due later

Use this to:
- See upcoming deadlines
- Find overdue assignments
- Get assignment IDs for detailed views`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          bucket: {
            type: 'string',
            enum: ['past', 'overdue', 'undated', 'unsubmitted', 'upcoming', 'future'],
            description: 'Filter by assignment bucket',
          },
          order_by: {
            type: 'string',
            enum: ['due_at', 'name', 'position'],
            description: 'Sort order. Default: due_at',
          },
          include_submission: {
            type: 'boolean',
            description: 'Include submission status for current user',
          },
        },
        required: ['course_id'],
      },
    },
    {
      name: 'canvas_assignment_get',
      description: `Get detailed information about a specific assignment.

Returns:
- Full description and instructions
- Due date, points possible
- Submission types allowed
- Rubric criteria (if available)
- Your submission status`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          assignment_id: {
            type: 'number',
            description: 'The assignment ID',
          },
          include_rubric: {
            type: 'boolean',
            description: 'Include rubric details if available',
          },
        },
        required: ['course_id', 'assignment_id'],
      },
    },
    {
      name: 'canvas_get_my_submission',
      description: `Get your submission for a specific assignment.

Returns:
- Submission status (submitted, graded, etc.)
- Score and grade
- Submission comments
- Rubric assessment (if graded with rubric)
- Submitted files or text`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          assignment_id: {
            type: 'number',
            description: 'The assignment ID',
          },
          include_rubric_assessment: {
            type: 'boolean',
            description: 'Include rubric assessment details',
          },
          include_comments: {
            type: 'boolean',
            description: 'Include submission comments',
          },
        },
        required: ['course_id', 'assignment_id'],
      },
    },
  ];
}

/**
 * Handle assignment tool calls
 */
export async function handleAssignmentTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_assignment_list':
      return await listAssignments(client, args);

    case 'canvas_assignment_get':
      return await getAssignment(client, args);

    case 'canvas_get_my_submission':
      return await getMySubmission(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown assignment tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List assignments in a course
 */
async function listAssignments(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const bucket = args?.bucket as AssignmentBucket | undefined;
  const orderBy = (args?.order_by as string) || 'due_at';
  const includeSubmission = args?.include_submission as boolean;

  if (!courseId) {
    return {
      content: [{ type: 'text', text: 'course_id is required' }],
      isError: true,
    };
  }

  const assignments = await client.listAssignments(courseId, bucket, orderBy, includeSubmission);

  if (assignments.length === 0) {
    const bucketInfo = bucket ? ` in "${bucket}" bucket` : '';
    return {
      content: [{ type: 'text', text: `No assignments found${bucketInfo}.` }],
    };
  }

  // Format assignment list
  const assignmentList = assignments.map((a) => {
    let info = `**${a.name}** (ID: ${a.id})`;

    if (a.due_at) {
      const dueDate = new Date(a.due_at);
      const isOverdue = dueDate < new Date() && a.submission?.workflow_state !== 'submitted';
      info += `\n  Due: ${dueDate.toLocaleString()}${isOverdue ? ' ⚠️ OVERDUE' : ''}`;
    } else {
      info += '\n  Due: No due date';
    }

    info += `\n  Points: ${a.points_possible ?? 'Ungraded'}`;

    if (includeSubmission && a.submission) {
      const sub = a.submission;
      let status = sub.workflow_state || 'not submitted';
      if (sub.grade !== undefined && sub.grade !== null) {
        status = `Graded: ${sub.grade}`;
        if (sub.score !== undefined) {
          status += ` (${sub.score}/${a.points_possible})`;
        }
      } else if (sub.submitted_at) {
        status = 'Submitted';
      }
      info += `\n  Status: ${status}`;
    }

    return info;
  });

  const bucketInfo = bucket ? ` (${bucket})` : '';
  return {
    content: [
      {
        type: 'text',
        text: `Found ${assignments.length} assignments${bucketInfo}:\n\n${assignmentList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * Get detailed assignment information
 */
async function getAssignment(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const assignmentId = args?.assignment_id as number;
  const includeRubric = args?.include_rubric as boolean;

  if (!courseId || !assignmentId) {
    return {
      content: [{ type: 'text', text: 'course_id and assignment_id are required' }],
      isError: true,
    };
  }

  const assignment = await client.getAssignment(courseId, assignmentId, includeRubric);

  // Format assignment details
  let details = `# ${assignment.name}\n\n`;
  details += `**Assignment ID:** ${assignment.id}\n`;
  details += `**Points Possible:** ${assignment.points_possible ?? 'Ungraded'}\n`;

  if (assignment.due_at) {
    details += `**Due Date:** ${new Date(assignment.due_at).toLocaleString()}\n`;
  }

  if (assignment.lock_at) {
    details += `**Locks At:** ${new Date(assignment.lock_at).toLocaleString()}\n`;
  }

  if (assignment.unlock_at) {
    details += `**Available From:** ${new Date(assignment.unlock_at).toLocaleString()}\n`;
  }

  if (assignment.submission_types?.length) {
    details += `**Submission Types:** ${assignment.submission_types.join(', ')}\n`;
  }

  if (assignment.allowed_extensions?.length) {
    details += `**Allowed Extensions:** ${assignment.allowed_extensions.join(', ')}\n`;
  }

  if (assignment.description) {
    details += `\n## Description\n\n${assignment.description}\n`;
  }

  // Include rubric if requested and available
  if (includeRubric && assignment.rubric) {
    details += '\n## Rubric\n\n';
    for (const criterion of assignment.rubric) {
      details += `### ${criterion.description} (${criterion.points} pts)\n`;
      if (criterion.long_description) {
        details += `${criterion.long_description}\n`;
      }
      if (criterion.ratings) {
        details += '\nRatings:\n';
        for (const rating of criterion.ratings) {
          details += `- **${rating.description}** (${rating.points} pts)`;
          if (rating.long_description) {
            details += `: ${rating.long_description}`;
          }
          details += '\n';
        }
      }
      details += '\n';
    }
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}

/**
 * Get user's submission for an assignment
 */
async function getMySubmission(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const assignmentId = args?.assignment_id as number;
  const includeRubric = args?.include_rubric_assessment as boolean;
  const includeComments = args?.include_comments as boolean;

  if (!courseId || !assignmentId) {
    return {
      content: [{ type: 'text', text: 'course_id and assignment_id are required' }],
      isError: true,
    };
  }

  const submission = await client.getMySubmission(courseId, assignmentId, includeRubric, includeComments);

  // Format submission details
  let details = `# Your Submission\n\n`;
  details += `**Status:** ${submission.workflow_state || 'Not submitted'}\n`;

  if (submission.submitted_at) {
    details += `**Submitted:** ${new Date(submission.submitted_at).toLocaleString()}\n`;
  }

  if (submission.grade !== undefined && submission.grade !== null) {
    details += `**Grade:** ${submission.grade}\n`;
  }

  if (submission.score !== undefined && submission.score !== null) {
    details += `**Score:** ${submission.score}\n`;
  }

  if (submission.late) {
    details += `**Late:** Yes\n`;
  }

  if (submission.missing) {
    details += `**Missing:** Yes\n`;
  }

  if (submission.attempt) {
    details += `**Attempt:** ${submission.attempt}\n`;
  }

  // Show submission content
  if (submission.body) {
    details += `\n## Submitted Text\n\n${submission.body}\n`;
  }

  if (submission.url) {
    details += `\n## Submitted URL\n\n${submission.url}\n`;
  }

  if (submission.attachments?.length) {
    details += '\n## Submitted Files\n\n';
    for (const file of submission.attachments) {
      details += `- ${file.display_name} (${file.size} bytes)\n`;
      details += `  URL: ${file.url}\n`;
    }
  }

  // Show rubric assessment if available
  if (includeRubric && submission.rubric_assessment) {
    details += '\n## Rubric Assessment\n\n';
    for (const [criterionId, assessment] of Object.entries(submission.rubric_assessment)) {
      const a = assessment as { points?: number; comments?: string; rating_id?: string };
      details += `- Criterion ${criterionId}: ${a.points ?? 'N/A'} pts`;
      if (a.comments) {
        details += `\n  Comment: ${a.comments}`;
      }
      details += '\n';
    }
  }

  // Show submission comments
  if (includeComments && submission.submission_comments?.length) {
    details += '\n## Comments\n\n';
    for (const comment of submission.submission_comments) {
      const author = comment.author_name || 'Unknown';
      const date = comment.created_at
        ? new Date(comment.created_at).toLocaleString()
        : 'Unknown date';
      details += `**${author}** (${date}):\n${comment.comment}\n\n`;
    }
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}
