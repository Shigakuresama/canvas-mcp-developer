/**
 * Groups Tools
 * Tools for interacting with Canvas groups
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register group-related tools
 */
export function registerGroupTools(): Tool[] {
  return [
    {
      name: 'canvas_group_list',
      description: `List all groups you are a member of.

Returns:
- Group names and descriptions
- Member counts
- Associated courses

Groups are used for:
- Group projects
- Study groups
- Peer review assignments`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_group_members',
      description: `List members of a specific group.

Returns:
- Member names
- Profile information
- Contact details (if shared)

Use to see who is in your group for collaboration.`,
      inputSchema: {
        type: 'object',
        properties: {
          group_id: {
            type: 'number',
            description: 'The group ID',
          },
        },
        required: ['group_id'],
      },
    },
  ];
}

/**
 * Handle group tool calls
 */
export async function handleGroupTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_group_list':
      return await listGroups(client, args);

    case 'canvas_group_members':
      return await getGroupMembers(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown group tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List user's groups
 */
async function listGroups(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const groups = await client.listMyGroups();

  if (groups.length === 0) {
    return {
      content: [{ type: 'text', text: 'You are not a member of any groups.' }],
    };
  }

  const groupList = groups.map((g) => {
    let info = `## ${g.name} (ID: ${g.id})`;

    if (g.description) {
      info += `\n${g.description}`;
    }

    info += `\n**Members:** ${g.members_count}`;

    if (g.course_id) {
      info += `\n**Course ID:** ${g.course_id}`;
    }

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Your Groups\n\nYou are a member of ${groups.length} group(s):\n\n${groupList.join('\n\n---\n\n')}`,
      },
    ],
  };
}

/**
 * Get group members
 */
async function getGroupMembers(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const groupId = args?.group_id as number;

  if (!groupId) {
    return {
      content: [{ type: 'text', text: 'group_id is required' }],
      isError: true,
    };
  }

  const members = await client.getGroupMembers(groupId);

  if (members.length === 0) {
    return {
      content: [{ type: 'text', text: 'No members found in this group.' }],
    };
  }

  const memberList = members.map((m, index) => {
    let info = `${index + 1}. **${m.name}**`;

    if (m.short_name && m.short_name !== m.name) {
      info += ` (${m.short_name})`;
    }

    if (m.email) {
      info += `\n   Email: ${m.email}`;
    }

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Group Members\n\n${members.length} member(s):\n\n${memberList.join('\n\n')}`,
      },
    ],
  };
}
