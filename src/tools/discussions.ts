/**
 * Discussions & Announcements Tools
 * Tools for interacting with Canvas discussions and announcements
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register discussion-related tools
 */
export function registerDiscussionTools(): Tool[] {
  return [
    {
      name: 'canvas_discussion_list',
      description: `List all discussion topics in a course.

Returns:
- Discussion titles and messages
- Post counts and unread counts
- Whether pinned or locked

Use this to:
- Find discussions to participate in
- See what's being discussed
- Check for unread posts`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          only_unread: {
            type: 'boolean',
            description: 'Only show discussions with unread posts',
          },
        },
        required: ['course_id'],
      },
    },
    {
      name: 'canvas_discussion_get',
      description: `Get a specific discussion with all replies.

Returns:
- Full discussion topic
- All replies (threaded)
- Author information

Use this to read and understand a discussion.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          topic_id: {
            type: 'number',
            description: 'The discussion topic ID',
          },
        },
        required: ['course_id', 'topic_id'],
      },
    },
    {
      name: 'canvas_announcement_list',
      description: `List announcements across courses.

Returns:
- Announcement titles and content
- Post dates
- Course context

Use this to stay updated on course announcements.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of course IDs to fetch announcements from',
          },
          start_date: {
            type: 'string',
            description: 'Only return announcements posted after this date (ISO format)',
          },
        },
        required: ['course_ids'],
      },
    },
  ];
}

/**
 * Handle discussion tool calls
 */
export async function handleDiscussionTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_discussion_list':
      return await listDiscussions(client, args);

    case 'canvas_discussion_get':
      return await getDiscussion(client, args);

    case 'canvas_announcement_list':
      return await listAnnouncements(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown discussion tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List discussions in a course
 */
async function listDiscussions(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const onlyUnread = args?.only_unread as boolean;

  if (!courseId) {
    return {
      content: [{ type: 'text', text: 'course_id is required' }],
      isError: true,
    };
  }

  let discussions = await client.listDiscussions(courseId);

  if (onlyUnread) {
    discussions = discussions.filter((d) => d.unread_count > 0);
  }

  if (discussions.length === 0) {
    const filterMsg = onlyUnread ? ' with unread posts' : '';
    return {
      content: [{ type: 'text', text: `No discussions found${filterMsg}.` }],
    };
  }

  // Sort: pinned first, then by date
  discussions.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
  });

  const discussionList = discussions.map((d) => {
    let info = `## ${d.pinned ? '📌 ' : ''}${d.title} (ID: ${d.id})`;
    info += `\n**Posted:** ${new Date(d.posted_at).toLocaleDateString()} by ${d.user_name}`;

    if (d.unread_count > 0) {
      info += `\n**Unread:** ${d.unread_count} posts`;
    }

    if (d.locked) {
      info += `\n**Status:** 🔒 Locked`;
    }

    // Show preview of message (first 200 chars)
    if (d.message) {
      const preview = d.message.replace(/<[^>]+>/g, '').substring(0, 200);
      info += `\n\n> ${preview}${d.message.length > 200 ? '...' : ''}`;
    }

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Course Discussions\n\nFound ${discussions.length} discussions:\n\n${discussionList.join('\n\n---\n\n')}`,
      },
    ],
  };
}

/**
 * Get a discussion with replies
 */
async function getDiscussion(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const topicId = args?.topic_id as number;

  if (!courseId || !topicId) {
    return {
      content: [{ type: 'text', text: 'course_id and topic_id are required' }],
      isError: true,
    };
  }

  const discussion = await client.getDiscussion(courseId, topicId);

  let details = `# ${discussion.subject || 'Discussion'}\n\n`;

  // Main topic
  if (discussion.message) {
    details += `## Original Post\n\n${discussion.message}\n\n`;
  }

  // Participants
  if (discussion.participants?.length) {
    details += `**Participants:** ${discussion.participants.length}\n\n`;
  }

  // Entries/replies
  if (discussion.view?.length) {
    details += `## Replies (${discussion.view.length})\n\n`;

    const formatEntry = (entry: any, depth: number = 0): string => {
      const indent = '  '.repeat(depth);
      let entryText = `${indent}**${entry.user_name || 'Unknown'}** (${new Date(entry.created_at).toLocaleString()}):\n`;
      entryText += `${indent}${entry.message?.replace(/<[^>]+>/g, '') || '[No content]'}\n`;

      if (entry.replies?.length) {
        for (const reply of entry.replies) {
          entryText += '\n' + formatEntry(reply, depth + 1);
        }
      }

      return entryText;
    };

    for (const entry of discussion.view) {
      details += formatEntry(entry) + '\n---\n\n';
    }
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}

/**
 * List announcements
 */
async function listAnnouncements(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseIds = args?.course_ids as number[];
  const startDate = args?.start_date as string;

  if (!courseIds?.length) {
    return {
      content: [{ type: 'text', text: 'course_ids array is required' }],
      isError: true,
    };
  }

  // Convert course IDs to context codes
  const contextCodes = courseIds.map((id) => `course_${id}`);

  let announcements = await client.listAnnouncements(contextCodes);

  // Filter by date if provided
  if (startDate) {
    const filterDate = new Date(startDate);
    announcements = announcements.filter(
      (a) => new Date(a.posted_at) >= filterDate
    );
  }

  if (announcements.length === 0) {
    return {
      content: [{ type: 'text', text: 'No announcements found.' }],
    };
  }

  // Sort by date (newest first)
  announcements.sort(
    (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
  );

  const announcementList = announcements.map((a) => {
    let info = `## ${a.title}`;
    info += `\n**Course:** ${a.context_code.replace('course_', 'Course ')}`;
    info += `\n**Posted:** ${new Date(a.posted_at).toLocaleString()} by ${a.user_name}`;

    if (a.message) {
      // Strip HTML for cleaner display
      const cleanMessage = a.message.replace(/<[^>]+>/g, '');
      info += `\n\n${cleanMessage}`;
    }

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Announcements\n\nFound ${announcements.length} announcements:\n\n${announcementList.join('\n\n---\n\n')}`,
      },
    ],
  };
}
