/**
 * Planner & TODO Tools
 * Tools for interacting with Canvas planner and todo items
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register planner-related tools
 */
export function registerPlannerTools(): Tool[] {
  return [
    {
      name: 'canvas_planner_items',
      description: `Get planner items - your upcoming assignments, quizzes, discussions, and events.

Returns:
- Due dates and times
- Course context
- Submission status
- Completion status

This is the best tool for:
- Seeing what's due soon
- Planning your week
- Finding overdue items`,
      inputSchema: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date for items (ISO format, default: today)',
          },
          end_date: {
            type: 'string',
            description: 'End date for items (ISO format, default: 2 weeks from now)',
          },
          filter: {
            type: 'string',
            enum: ['all', 'new_activity', 'unsubmitted'],
            description: 'Filter items. Default: all',
          },
        },
      },
    },
    {
      name: 'canvas_todo_list',
      description: `Get your TODO list items that need attention.

Returns items needing action:
- Assignments to submit
- Items to grade (if instructor)
- Unread discussions

Use this for a quick view of what needs immediate attention.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'Optional: limit to specific course',
          },
        },
      },
    },
    {
      name: 'canvas_upcoming_events',
      description: `Get upcoming calendar events.

Returns:
- Assignment due dates
- Calendar events
- Quizzes
- Other scheduled items

Different from planner in that it shows calendar-based view.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_missing_submissions',
      description: `Get all missing submissions across courses.

Returns:
- Assignments you haven't submitted
- Due dates (past)
- Course context
- Points possible

Critical for finding overdue work!`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

/**
 * Handle planner tool calls
 */
export async function handlePlannerTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_planner_items':
      return await getPlannerItems(client, args);

    case 'canvas_todo_list':
      return await getTodoList(client, args);

    case 'canvas_upcoming_events':
      return await getUpcomingEvents(client, args);

    case 'canvas_missing_submissions':
      return await getMissingSubmissions(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown planner tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * Get planner items
 */
async function getPlannerItems(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const items = await client.listPlannerItems();

  if (items.length === 0) {
    return {
      content: [{ type: 'text', text: 'No planner items found.' }],
    };
  }

  // Group by date
  const grouped = new Map<string, typeof items>();
  const now = new Date();

  for (const item of items) {
    const dateKey = item.plannable_date
      ? new Date(item.plannable_date).toLocaleDateString()
      : 'No Date';

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(item);
  }

  let output = '# Planner Items\n\n';

  // Sort dates
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    if (a === 'No Date') return 1;
    if (b === 'No Date') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  for (const dateKey of sortedDates) {
    const dateItems = grouped.get(dateKey)!;
    const date = dateKey === 'No Date' ? null : new Date(dateKey);

    // Check if overdue
    const isOverdue = date && date < now;
    const dateLabel = isOverdue ? `${dateKey} ⚠️ OVERDUE` : dateKey;

    output += `## ${dateLabel}\n\n`;

    for (const item of dateItems) {
      const completed = item.planner_override?.marked_complete;
      const submitted = item.submissions?.submitted;
      const status = completed ? '✓' : submitted ? '📤' : '○';

      output += `${status} **${item.plannable.title}**\n`;
      output += `   Course: ${item.context_name}\n`;
      output += `   Type: ${item.plannable_type}\n`;

      if (item.plannable.points_possible) {
        output += `   Points: ${item.plannable.points_possible}\n`;
      }

      if (item.plannable.due_at) {
        output += `   Due: ${new Date(item.plannable.due_at).toLocaleString()}\n`;
      }

      output += '\n';
    }
  }

  // Summary
  const submitted = items.filter((i) => i.submissions?.submitted).length;
  const completed = items.filter((i) => i.planner_override?.marked_complete).length;
  const pending = items.length - Math.max(submitted, completed);

  output += `---\n\n**Summary:** ${items.length} items | ${submitted} submitted | ${completed} completed | ${pending} pending\n`;

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Get TODO list
 */
async function getTodoList(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const courseId = args?.course_id as number | undefined;

  let todos;
  if (courseId) {
    todos = await client.getCourseTodo(courseId);
  } else {
    todos = await client.getGlobalTodo();
  }

  if (todos.length === 0) {
    return {
      content: [{ type: 'text', text: 'No TODO items! You\'re all caught up. 🎉' }],
    };
  }

  let output = '# TODO List\n\n';

  for (const todo of todos) {
    output += `## ${todo.assignment?.name || todo.quiz?.title || 'Item'}\n`;
    output += `**Type:** ${todo.type}\n`;

    if (todo.context_name) {
      output += `**Course:** ${todo.context_name}\n`;
    }

    if (todo.assignment?.due_at) {
      const dueDate = new Date(todo.assignment.due_at);
      const isOverdue = dueDate < new Date();
      output += `**Due:** ${dueDate.toLocaleString()}${isOverdue ? ' ⚠️ OVERDUE' : ''}\n`;
    }

    if (todo.assignment?.points_possible) {
      output += `**Points:** ${todo.assignment.points_possible}\n`;
    }

    if (todo.html_url) {
      output += `**URL:** ${todo.html_url}\n`;
    }

    output += '\n';
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Get upcoming events
 */
async function getUpcomingEvents(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const events = await client.listUpcomingEvents();

  if (events.length === 0) {
    return {
      content: [{ type: 'text', text: 'No upcoming events.' }],
    };
  }

  let output = '# Upcoming Events\n\n';

  for (const event of events) {
    const startDate = event.start_at ? new Date(event.start_at) : null;
    const endDate = event.end_at ? new Date(event.end_at) : null;

    output += `## ${event.title || event.assignment?.name || 'Event'}\n`;
    output += `**Type:** ${event.type || 'Event'}\n`;

    if (event.context_name) {
      output += `**Course:** ${event.context_name}\n`;
    }

    if (startDate) {
      output += `**When:** ${startDate.toLocaleString()}`;
      if (endDate && endDate.getTime() !== startDate.getTime()) {
        output += ` - ${endDate.toLocaleString()}`;
      }
      output += '\n';
    }

    if (event.assignment?.points_possible) {
      output += `**Points:** ${event.assignment.points_possible}\n`;
    }

    if (event.html_url) {
      output += `**URL:** ${event.html_url}\n`;
    }

    output += '\n';
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Get missing submissions
 */
async function getMissingSubmissions(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const missing = await client.getMissingSubmissions();

  if (missing.length === 0) {
    return {
      content: [{ type: 'text', text: 'No missing submissions! Great job! 🎉' }],
    };
  }

  let output = '# Missing Submissions ⚠️\n\n';
  output += `You have **${missing.length}** missing submissions:\n\n`;

  // Sort by due date (most recent first)
  missing.sort((a, b) => {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(b.due_at).getTime() - new Date(a.due_at).getTime();
  });

  // Group by course
  const byCourse = new Map<string, typeof missing>();
  for (const assignment of missing) {
    const courseKey = `Course ${assignment.course_id}`;
    if (!byCourse.has(courseKey)) {
      byCourse.set(courseKey, []);
    }
    byCourse.get(courseKey)!.push(assignment);
  }

  let totalPoints = 0;

  for (const [course, assignments] of byCourse) {
    output += `## ${course}\n\n`;

    for (const a of assignments) {
      output += `- **${a.name}** (ID: ${a.id})\n`;

      if (a.due_at) {
        const dueDate = new Date(a.due_at);
        const daysLate = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        output += `  Due: ${dueDate.toLocaleDateString()} (${daysLate} days late)\n`;
      }

      if (a.points_possible) {
        output += `  Points: ${a.points_possible}\n`;
        totalPoints += a.points_possible;
      }

      output += '\n';
    }
  }

  output += `---\n\n**Total points at risk:** ${totalPoints}\n`;
  output += '\nSubmit these as soon as possible to minimize grade impact!';

  return {
    content: [{ type: 'text', text: output }],
  };
}
