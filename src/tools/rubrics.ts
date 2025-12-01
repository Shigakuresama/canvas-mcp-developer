/**
 * Rubrics Tools
 * Tools for interacting with Canvas rubrics
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register rubric-related tools
 */
export function registerRubricTools(): Tool[] {
  return [
    {
      name: 'canvas_rubric_list',
      description: `List all rubrics in a course.

Rubrics define grading criteria for assignments. Returns:
- Rubric titles and descriptions
- Points possible
- Number of criteria

Use this to:
- See grading standards for a course
- Find rubric IDs for detailed views`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
        },
        required: ['course_id'],
      },
    },
    {
      name: 'canvas_rubric_get',
      description: `Get detailed rubric with all criteria and ratings.

Returns:
- All criteria descriptions
- Point values for each criterion
- Rating descriptions and points
- Any free-form comment settings

Essential for understanding how work will be graded.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          rubric_id: {
            type: 'number',
            description: 'The rubric ID',
          },
        },
        required: ['course_id', 'rubric_id'],
      },
    },
    {
      name: 'canvas_rubric_for_assignment',
      description: `Get the rubric attached to a specific assignment.

Directly retrieves the grading criteria for an assignment.
More convenient than finding rubric ID separately.`,
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
        },
        required: ['course_id', 'assignment_id'],
      },
    },
  ];
}

/**
 * Handle rubric tool calls
 */
export async function handleRubricTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_rubric_list':
      return await listRubrics(client, args);

    case 'canvas_rubric_get':
      return await getRubric(client, args);

    case 'canvas_rubric_for_assignment':
      return await getRubricForAssignment(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown rubric tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List rubrics in a course
 */
async function listRubrics(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;

  if (!courseId) {
    return {
      content: [{ type: 'text', text: 'course_id is required' }],
      isError: true,
    };
  }

  const rubrics = await client.listRubrics(courseId);

  if (rubrics.length === 0) {
    return {
      content: [{ type: 'text', text: 'No rubrics found in this course.' }],
    };
  }

  const rubricList = rubrics.map((r) => {
    let info = `## ${r.title} (ID: ${r.id})`;
    info += `\n**Points Possible:** ${r.points_possible}`;
    info += `\n**Criteria:** ${r.data?.length || 0} items`;
    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Course Rubrics\n\nFound ${rubrics.length} rubrics:\n\n${rubricList.join('\n\n---\n\n')}`,
      },
    ],
  };
}

/**
 * Get detailed rubric
 */
async function getRubric(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const rubricId = args?.rubric_id as number;

  if (!courseId || !rubricId) {
    return {
      content: [{ type: 'text', text: 'course_id and rubric_id are required' }],
      isError: true,
    };
  }

  const rubric = await client.getRubric(courseId, rubricId);

  let details = `# ${rubric.title}\n\n`;
  details += `**Total Points:** ${rubric.points_possible}\n\n`;

  if (rubric.data?.length) {
    details += `## Criteria\n\n`;

    for (const criterion of rubric.data) {
      details += `### ${criterion.description} (${criterion.points} pts)\n`;

      if (criterion.long_description) {
        details += `${criterion.long_description}\n\n`;
      }

      if (criterion.ratings?.length) {
        details += '**Ratings:**\n';
        for (const rating of criterion.ratings) {
          details += `- **${rating.description}** (${rating.points} pts)`;
          if (rating.long_description) {
            details += `\n  ${rating.long_description}`;
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
 * Get rubric for an assignment
 */
async function getRubricForAssignment(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const assignmentId = args?.assignment_id as number;

  if (!courseId || !assignmentId) {
    return {
      content: [{ type: 'text', text: 'course_id and assignment_id are required' }],
      isError: true,
    };
  }

  // Get assignment with rubric
  const assignment = await client.getAssignment(courseId, assignmentId, true);

  if (!assignment.rubric?.length) {
    return {
      content: [
        {
          type: 'text',
          text: `No rubric attached to assignment "${assignment.name}".`,
        },
      ],
    };
  }

  let details = `# Rubric for: ${assignment.name}\n\n`;
  details += `**Assignment Points:** ${assignment.points_possible}\n\n`;

  details += `## Grading Criteria\n\n`;

  for (const criterion of assignment.rubric) {
    details += `### ${criterion.description} (${criterion.points} pts)\n`;

    if (criterion.long_description) {
      details += `${criterion.long_description}\n\n`;
    }

    if (criterion.ratings?.length) {
      details += '**Scoring Guide:**\n';
      for (const rating of criterion.ratings) {
        details += `- **${rating.points} pts - ${rating.description}**`;
        if (rating.long_description) {
          details += `\n  ${rating.long_description}`;
        }
        details += '\n';
      }
    }

    details += '\n';
  }

  // Add rubric settings if available
  if (assignment.rubric_settings) {
    details += `---\n\n**Settings:**\n`;
    details += `- Free-form comments: ${assignment.rubric_settings.free_form_criterion_comments ? 'Yes' : 'No'}\n`;
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}
