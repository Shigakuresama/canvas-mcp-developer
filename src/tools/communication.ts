/**
 * Communication Tools
 * Tools for Canvas inbox/conversations
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register communication-related tools
 */
export function registerCommunicationTools(): Tool[] {
  return [
    {
      name: 'canvas_inbox_list',
      description: `List your Canvas inbox conversations.

Returns:
- Conversation subjects
- Last message preview
- Participants
- Read/unread status

Use to check messages from instructors and classmates.`,
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'unread', 'starred', 'archived'],
            description: 'Filter conversations. Default: all',
          },
        },
      },
    },
    {
      name: 'canvas_inbox_get',
      description: `Get a specific conversation with all messages.

Returns:
- Full conversation thread
- All messages with timestamps
- Attachments information
- Participant details`,
      inputSchema: {
        type: 'object',
        properties: {
          conversation_id: {
            type: 'number',
            description: 'The conversation ID',
          },
        },
        required: ['conversation_id'],
      },
    },
    {
      name: 'canvas_inbox_unread_count',
      description: `Get count of unread messages.

Quick check for new messages without loading full inbox.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_notification_list',
      description: `List account notifications/announcements.

Returns system-wide announcements from your institution:
- Important notices
- System maintenance alerts
- Policy updates`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

/**
 * Handle communication tool calls
 */
export async function handleCommunicationTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_inbox_list':
      return await listConversations(client, args);

    case 'canvas_inbox_get':
      return await getConversation(client, args);

    case 'canvas_inbox_unread_count':
      return await getUnreadCount(client, args);

    case 'canvas_notification_list':
      return await listNotifications(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown communication tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List conversations
 */
async function listConversations(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const filter = (args?.filter as string) || 'all';

  let conversations = await client.listConversations();

  // Apply filter
  switch (filter) {
    case 'unread':
      conversations = conversations.filter((c) => c.workflow_state === 'unread');
      break;
    case 'starred':
      conversations = conversations.filter((c) => c.starred);
      break;
    case 'archived':
      conversations = conversations.filter((c) => c.workflow_state === 'archived');
      break;
  }

  if (conversations.length === 0) {
    return {
      content: [{ type: 'text', text: `No ${filter === 'all' ? '' : filter + ' '}conversations found.` }],
    };
  }

  // Sort by last message date
  conversations.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  const convList = conversations.map((c) => {
    const unreadIcon = c.workflow_state === 'unread' ? '🔵 ' : '';
    const starredIcon = c.starred ? '⭐ ' : '';

    let info = `## ${unreadIcon}${starredIcon}${c.subject || '(No Subject)'} (ID: ${c.id})`;

    // Participants
    const participantNames = c.participants?.map((p) => p.name).join(', ') || 'Unknown';
    info += `\n**With:** ${participantNames}`;

    info += `\n**Messages:** ${c.message_count}`;
    info += `\n**Last:** ${new Date(c.last_message_at).toLocaleString()}`;

    // Preview of last message
    if (c.last_message) {
      const preview = c.last_message.substring(0, 100);
      info += `\n\n> ${preview}${c.last_message.length > 100 ? '...' : ''}`;
    }

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Inbox (${filter})\n\n${conversations.length} conversation(s):\n\n${convList.join('\n\n---\n\n')}`,
      },
    ],
  };
}

/**
 * Get single conversation
 */
async function getConversation(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const conversationId = args?.conversation_id as number;

  if (!conversationId) {
    return {
      content: [{ type: 'text', text: 'conversation_id is required' }],
      isError: true,
    };
  }

  const conversation = await client.getConversation(conversationId);

  let details = `# ${conversation.subject || '(No Subject)'}\n\n`;

  // Participants
  const participantNames = conversation.participants?.map((p) => p.name).join(', ') || 'Unknown';
  details += `**Participants:** ${participantNames}\n`;
  details += `**Messages:** ${conversation.message_count}\n\n`;

  // Messages
  if (conversation.messages?.length) {
    details += `## Messages\n\n`;

    for (const msg of conversation.messages) {
      const author = conversation.participants?.find((p) => p.id === msg.author_id);
      const authorName = author?.name || 'Unknown';
      const date = new Date(msg.created_at).toLocaleString();

      details += `### ${authorName} - ${date}\n\n`;
      details += `${msg.body}\n\n`;

      if (msg.attachments?.length) {
        details += '**Attachments:**\n';
        for (const att of msg.attachments) {
          details += `- ${att.display_name} (${att.size} bytes)\n`;
        }
        details += '\n';
      }

      details += '---\n\n';
    }
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}

/**
 * Get unread count
 */
async function getUnreadCount(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const result = await client.getUnreadMessagesCount();

  const count = result.unread_count;

  if (count === 0) {
    return {
      content: [{ type: 'text', text: 'No unread messages. 📭' }],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `You have **${count}** unread message${count !== 1 ? 's' : ''}. 📬`,
      },
    ],
  };
}

/**
 * List account notifications
 */
async function listNotifications(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const notifications = await client.listAccountNotifications();

    if (notifications.length === 0) {
      return {
        content: [{ type: 'text', text: 'No account notifications.' }],
      };
    }

    const notifList = notifications.map((n) => {
      const icon = {
        warning: '⚠️',
        information: 'ℹ️',
        question: '❓',
        error: '❌',
        calendar: '📅',
      }[n.icon] || '📢';

      let info = `## ${icon} ${n.subject}`;
      info += `\n**Valid:** ${new Date(n.start_at).toLocaleDateString()} - ${new Date(n.end_at).toLocaleDateString()}`;

      if (n.message) {
        info += `\n\n${n.message.replace(/<[^>]+>/g, '')}`;
      }

      return info;
    });

    return {
      content: [
        {
          type: 'text',
          text: `# Account Notifications\n\n${notifList.join('\n\n---\n\n')}`,
        },
      ],
    };
  } catch {
    return {
      content: [{ type: 'text', text: 'Unable to fetch account notifications.' }],
    };
  }
}
