/**
 * Quizzes Tools
 * Tools for interacting with Canvas quizzes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register quiz-related tools
 */
export function registerQuizTools(): Tool[] {
  return [
    {
      name: 'canvas_quiz_list',
      description: `List all quizzes in a course.

Returns:
- Quiz titles and descriptions
- Due dates and time limits
- Number of questions
- Points possible
- Allowed attempts

Use this to:
- See upcoming quizzes
- Find quiz IDs for details
- Check quiz settings`,
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
      name: 'canvas_quiz_get',
      description: `Get detailed information about a specific quiz.

Returns:
- Full description
- Time limit and attempts
- Due date, lock dates
- Question count
- Quiz type (practice, graded, survey)

Note: Cannot retrieve actual quiz questions via API.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          quiz_id: {
            type: 'number',
            description: 'The quiz ID',
          },
        },
        required: ['course_id', 'quiz_id'],
      },
    },
    {
      name: 'canvas_quiz_submission',
      description: `Get your submission/attempt for a quiz.

Returns:
- Attempt number
- Score and kept score
- Started/finished times
- Workflow state

Use to check your quiz results.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          quiz_id: {
            type: 'number',
            description: 'The quiz ID',
          },
        },
        required: ['course_id', 'quiz_id'],
      },
    },
  ];
}

/**
 * Handle quiz tool calls
 */
export async function handleQuizTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_quiz_list':
      return await listQuizzes(client, args);

    case 'canvas_quiz_get':
      return await getQuiz(client, args);

    case 'canvas_quiz_submission':
      return await getQuizSubmission(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown quiz tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List quizzes in a course
 */
async function listQuizzes(
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

  const quizzes = await client.listQuizzes(courseId);

  if (quizzes.length === 0) {
    return {
      content: [{ type: 'text', text: 'No quizzes found in this course.' }],
    };
  }

  // Sort by due date
  quizzes.sort((a, b) => {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const quizList = quizzes.map((q) => {
    let info = `## ${q.title} (ID: ${q.id})`;
    info += `\n**Type:** ${q.quiz_type}`;
    info += `\n**Points:** ${q.points_possible}`;
    info += `\n**Questions:** ${q.question_count}`;

    if (q.time_limit) {
      info += `\n**Time Limit:** ${q.time_limit} minutes`;
    }

    if (q.allowed_attempts !== -1) {
      info += `\n**Attempts:** ${q.allowed_attempts}`;
    } else {
      info += `\n**Attempts:** Unlimited`;
    }

    if (q.due_at) {
      const dueDate = new Date(q.due_at);
      const isOverdue = dueDate < new Date();
      info += `\n**Due:** ${dueDate.toLocaleString()}${isOverdue ? ' ⚠️ PAST' : ''}`;
    }

    info += `\n**Published:** ${q.published ? 'Yes' : 'No'}`;

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Course Quizzes\n\nFound ${quizzes.length} quizzes:\n\n${quizList.join('\n\n---\n\n')}`,
      },
    ],
  };
}

/**
 * Get quiz details
 */
async function getQuiz(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const quizId = args?.quiz_id as number;

  if (!courseId || !quizId) {
    return {
      content: [{ type: 'text', text: 'course_id and quiz_id are required' }],
      isError: true,
    };
  }

  const quiz = await client.getQuiz(courseId, quizId);

  let details = `# ${quiz.title}\n\n`;
  details += `**Quiz ID:** ${quiz.id}\n`;
  details += `**Type:** ${quiz.quiz_type}\n`;
  details += `**Points Possible:** ${quiz.points_possible}\n`;
  details += `**Question Count:** ${quiz.question_count}\n`;

  if (quiz.time_limit) {
    details += `**Time Limit:** ${quiz.time_limit} minutes\n`;
  } else {
    details += `**Time Limit:** No limit\n`;
  }

  if (quiz.allowed_attempts !== -1) {
    details += `**Allowed Attempts:** ${quiz.allowed_attempts}\n`;
  } else {
    details += `**Allowed Attempts:** Unlimited\n`;
  }

  details += `**Published:** ${quiz.published ? 'Yes' : 'No'}\n`;

  if (quiz.due_at) {
    details += `**Due:** ${new Date(quiz.due_at).toLocaleString()}\n`;
  }

  if (quiz.unlock_at) {
    details += `**Available From:** ${new Date(quiz.unlock_at).toLocaleString()}\n`;
  }

  if (quiz.lock_at) {
    details += `**Available Until:** ${new Date(quiz.lock_at).toLocaleString()}\n`;
  }

  if (quiz.description) {
    details += `\n## Description\n\n${quiz.description.replace(/<[^>]+>/g, '')}\n`;
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}

/**
 * Get quiz submission
 */
async function getQuizSubmission(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const quizId = args?.quiz_id as number;

  if (!courseId || !quizId) {
    return {
      content: [{ type: 'text', text: 'course_id and quiz_id are required' }],
      isError: true,
    };
  }

  try {
    const submission = await client.getMyQuizSubmission(courseId, quizId);

    // The API returns a wrapper object
    const sub = submission.quiz_submissions?.[0];

    if (!sub) {
      return {
        content: [{ type: 'text', text: 'No submission found for this quiz.' }],
      };
    }

    let details = `# Quiz Submission\n\n`;
    details += `**Status:** ${sub.workflow_state}\n`;
    details += `**Attempt:** ${sub.attempt}\n`;

    if (sub.score !== undefined && sub.score !== null) {
      details += `**Score:** ${sub.score}\n`;
    }

    if (sub.kept_score !== undefined && sub.kept_score !== null) {
      details += `**Kept Score:** ${sub.kept_score}\n`;
    }

    if (sub.started_at) {
      details += `**Started:** ${new Date(sub.started_at).toLocaleString()}\n`;
    }

    if (sub.finished_at) {
      details += `**Finished:** ${new Date(sub.finished_at).toLocaleString()}\n`;
    }

    if (sub.end_at) {
      details += `**Due By:** ${new Date(sub.end_at).toLocaleString()}\n`;
    }

    return {
      content: [{ type: 'text', text: details }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: 'No quiz submission found. You may not have started this quiz yet.',
        },
      ],
    };
  }
}
