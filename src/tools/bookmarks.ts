/**
 * Bookmarks Tools
 * Tools for managing Canvas bookmarks
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register bookmark-related tools
 */
export function registerBookmarkTools(): Tool[] {
  return [
    {
      name: 'canvas_bookmark_list',
      description: `List all your Canvas bookmarks.

Bookmarks provide quick access to frequently used pages.

Returns:
- Bookmark names
- Target URLs
- Position/order`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'canvas_bookmark_create',
      description: `Create a new bookmark.

Add a quick-access link to any Canvas page.

Requires:
- Name for the bookmark
- URL to bookmark`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name for the bookmark',
          },
          url: {
            type: 'string',
            description: 'URL to bookmark',
          },
        },
        required: ['name', 'url'],
      },
    },
    {
      name: 'canvas_bookmark_delete',
      description: `Delete a bookmark.

Remove a bookmark from your list.`,
      inputSchema: {
        type: 'object',
        properties: {
          bookmark_id: {
            type: 'number',
            description: 'The bookmark ID to delete',
          },
        },
        required: ['bookmark_id'],
      },
    },
  ];
}

/**
 * Handle bookmark tool calls
 */
export async function handleBookmarkTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_bookmark_list':
      return await listBookmarks(client, args);

    case 'canvas_bookmark_create':
      return await createBookmark(client, args);

    case 'canvas_bookmark_delete':
      return await deleteBookmark(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown bookmark tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * List bookmarks
 */
async function listBookmarks(
  client: CanvasClient,
  _args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const bookmarks = await client.listBookmarks();

  if (bookmarks.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No bookmarks found. Use canvas_bookmark_create to add one.',
        },
      ],
    };
  }

  // Sort by position
  bookmarks.sort((a, b) => a.position - b.position);

  const bookmarkList = bookmarks.map((b, index) => {
    return `${index + 1}. **${b.name}** (ID: ${b.id})\n   ${b.url}`;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Your Bookmarks\n\n${bookmarkList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * Create bookmark
 */
async function createBookmark(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const name = args?.name as string;
  const url = args?.url as string;

  if (!name || !url) {
    return {
      content: [{ type: 'text', text: 'name and url are required' }],
      isError: true,
    };
  }

  const bookmark = await client.createBookmark(name, url);

  return {
    content: [
      {
        type: 'text',
        text: `# Bookmark Created\n\n**Name:** ${bookmark.name}\n**URL:** ${bookmark.url}\n**ID:** ${bookmark.id}`,
      },
    ],
  };
}

/**
 * Delete bookmark
 */
async function deleteBookmark(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const bookmarkId = args?.bookmark_id as number;

  if (!bookmarkId) {
    return {
      content: [{ type: 'text', text: 'bookmark_id is required' }],
      isError: true,
    };
  }

  await client.deleteBookmark(bookmarkId);

  return {
    content: [
      {
        type: 'text',
        text: `Bookmark ${bookmarkId} deleted successfully.`,
      },
    ],
  };
}
