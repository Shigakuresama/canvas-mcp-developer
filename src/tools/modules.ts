/**
 * Module Tools
 * Tools for interacting with Canvas course modules
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register module-related tools
 */
export function registerModuleTools(): Tool[] {
  return [
    {
      name: 'canvas_module_list',
      description: `List all modules in a course with their items and completion status.

Modules organize course content into logical sections. Each module can contain:
- Assignments
- Pages
- Files
- Quizzes
- Discussions
- External links

Use this to:
- See course structure and organization
- Track module completion progress
- Find specific content within modules`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          include_items: {
            type: 'boolean',
            description: 'Include module items in response (default: true)',
          },
        },
        required: ['course_id'],
      },
    },
    {
      name: 'canvas_module_get',
      description: `Get detailed information about a specific module.

Returns:
- Module name and position
- Prerequisites required
- Completion requirements
- All items in the module`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          module_id: {
            type: 'number',
            description: 'The module ID',
          },
        },
        required: ['course_id', 'module_id'],
      },
    },
    {
      name: 'canvas_module_items',
      description: `List all items within a specific module.

Returns detailed information about each item:
- Type (Assignment, Page, File, Quiz, etc.)
- Title and URL
- Completion requirements
- Whether completed`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          module_id: {
            type: 'number',
            description: 'The module ID',
          },
        },
        required: ['course_id', 'module_id'],
      },
    },
    {
      name: 'canvas_module_progress',
      description: `Get your progress through course modules.

Returns:
- Which modules are completed
- Which are in progress
- Which are locked
- Requirements remaining`,
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
  ];
}

/**
 * Handle module tool calls
 */
export async function handleModuleTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_module_list':
      return await listModules(client, args);

    case 'canvas_module_get':
      return await getModule(client, args);

    case 'canvas_module_items':
      return await listModuleItems(client, args);

    case 'canvas_module_progress':
      return await getModuleProgress(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown module tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List all modules in a course
 */
async function listModules(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const includeItems = args?.include_items !== false;

  if (!courseId) {
    return {
      content: [{ type: 'text', text: 'course_id is required' }],
      isError: true,
    };
  }

  const modules = await client.listModules(courseId);

  if (modules.length === 0) {
    return {
      content: [{ type: 'text', text: 'No modules found in this course.' }],
    };
  }

  // Format module list
  const moduleList = modules.map((mod) => {
    let info = `## ${mod.name} (ID: ${mod.id})`;
    info += `\n**Status:** ${mod.state}`;

    if (mod.prerequisite_module_ids?.length) {
      info += `\n**Prerequisites:** ${mod.prerequisite_module_ids.length} module(s) required`;
    }

    if (mod.unlock_at) {
      info += `\n**Unlocks:** ${new Date(mod.unlock_at).toLocaleString()}`;
    }

    if (mod.completed_at) {
      info += `\n**Completed:** ${new Date(mod.completed_at).toLocaleString()}`;
    }

    if (includeItems && mod.items?.length) {
      info += `\n**Items (${mod.items.length}):**`;
      for (const item of mod.items) {
        const completed = item.completion_requirement?.completed ? '✓' : '○';
        info += `\n  ${completed} ${item.title} (${item.type})`;
      }
    } else {
      info += `\n**Items:** ${mod.items_count}`;
    }

    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Course Modules\n\nFound ${modules.length} modules:\n\n${moduleList.join('\n\n---\n\n')}`,
      },
    ],
  };
}

/**
 * Get detailed module information
 */
async function getModule(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const moduleId = args?.module_id as number;

  if (!courseId || !moduleId) {
    return {
      content: [{ type: 'text', text: 'course_id and module_id are required' }],
      isError: true,
    };
  }

  const mod = await client.getModule(courseId, moduleId);

  let details = `# ${mod.name}\n\n`;
  details += `**Module ID:** ${mod.id}\n`;
  details += `**Position:** ${mod.position}\n`;
  details += `**Status:** ${mod.state}\n`;

  if (mod.require_sequential_progress) {
    details += `**Sequential Progress:** Required\n`;
  }

  if (mod.prerequisite_module_ids?.length) {
    details += `**Prerequisites:** Module IDs ${mod.prerequisite_module_ids.join(', ')}\n`;
  }

  if (mod.unlock_at) {
    details += `**Unlocks:** ${new Date(mod.unlock_at).toLocaleString()}\n`;
  }

  if (mod.completed_at) {
    details += `**Completed:** ${new Date(mod.completed_at).toLocaleString()}\n`;
  }

  if (mod.items?.length) {
    details += `\n## Items (${mod.items.length})\n\n`;
    for (const item of mod.items) {
      const completed = item.completion_requirement?.completed ? '✓' : '○';
      details += `### ${completed} ${item.title}\n`;
      details += `- **Type:** ${item.type}\n`;
      if (item.html_url) {
        details += `- **URL:** ${item.html_url}\n`;
      }
      if (item.completion_requirement) {
        details += `- **Requirement:** ${item.completion_requirement.type}`;
        if (item.completion_requirement.min_score) {
          details += ` (min score: ${item.completion_requirement.min_score})`;
        }
        details += '\n';
      }
      details += '\n';
    }
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}

/**
 * List items in a module
 */
async function listModuleItems(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const moduleId = args?.module_id as number;

  if (!courseId || !moduleId) {
    return {
      content: [{ type: 'text', text: 'course_id and module_id are required' }],
      isError: true,
    };
  }

  const items = await client.listModuleItems(courseId, moduleId);

  if (items.length === 0) {
    return {
      content: [{ type: 'text', text: 'No items in this module.' }],
    };
  }

  const itemList = items.map((item, index) => {
    const completed = item.completion_requirement?.completed ? '✓' : '○';
    let info = `${index + 1}. ${completed} **${item.title}**`;
    info += `\n   Type: ${item.type}`;
    if (item.content_id) {
      info += ` | Content ID: ${item.content_id}`;
    }
    if (item.html_url) {
      info += `\n   URL: ${item.html_url}`;
    }
    if (item.completion_requirement) {
      info += `\n   Requirement: ${item.completion_requirement.type}`;
      if (item.completion_requirement.min_score) {
        info += ` (min: ${item.completion_requirement.min_score})`;
      }
    }
    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Module Items\n\n${itemList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * Get module progress
 */
async function getModuleProgress(
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

  const modules = await client.listModules(courseId);

  // Calculate progress
  const completed = modules.filter((m) => m.state === 'completed');
  const inProgress = modules.filter((m) => m.state === 'started');
  const locked = modules.filter((m) => m.state === 'locked');
  const unlocked = modules.filter((m) => m.state === 'unlocked');

  let details = `# Module Progress\n\n`;
  details += `**Total Modules:** ${modules.length}\n`;
  details += `**Completed:** ${completed.length}\n`;
  details += `**In Progress:** ${inProgress.length}\n`;
  details += `**Unlocked:** ${unlocked.length}\n`;
  details += `**Locked:** ${locked.length}\n`;

  const completionPercent = modules.length > 0
    ? Math.round((completed.length / modules.length) * 100)
    : 0;
  details += `\n**Overall Progress:** ${completionPercent}%\n`;

  if (inProgress.length > 0) {
    details += '\n## Currently In Progress\n\n';
    for (const mod of inProgress) {
      const itemsComplete = mod.items?.filter((i) => i.completion_requirement?.completed).length || 0;
      const totalItems = mod.items?.length || mod.items_count;
      details += `- **${mod.name}**: ${itemsComplete}/${totalItems} items\n`;
    }
  }

  if (locked.length > 0) {
    details += '\n## Locked Modules\n\n';
    for (const mod of locked) {
      details += `- ${mod.name}`;
      if (mod.unlock_at) {
        details += ` (unlocks ${new Date(mod.unlock_at).toLocaleDateString()})`;
      }
      details += '\n';
    }
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}
