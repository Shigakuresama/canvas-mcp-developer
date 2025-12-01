/**
 * Files Tools
 * Tools for interacting with Canvas course files
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CanvasClient } from '../core/client.js';

/**
 * Register file-related tools
 */
export function registerFileTools(): Tool[] {
  return [
    {
      name: 'canvas_file_list',
      description: `List all files in a course.

Returns:
- File name and size
- Content type
- Download URL
- Creation/update dates

Use this to:
- Browse course materials
- Find documents to download
- Get file IDs for other operations`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          sort_by: {
            type: 'string',
            enum: ['name', 'size', 'created_at', 'updated_at'],
            description: 'Sort files by field. Default: name',
          },
        },
        required: ['course_id'],
      },
    },
    {
      name: 'canvas_file_get',
      description: `Get detailed information about a specific file.

Returns:
- Full filename and display name
- File size and content type
- Download URL
- Thumbnail URL (if image)`,
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'number',
            description: 'The Canvas file ID',
          },
        },
        required: ['file_id'],
      },
    },
    {
      name: 'canvas_file_search',
      description: `Search for files in a course by name.

Returns files matching the search term.
Useful for finding specific documents.`,
      inputSchema: {
        type: 'object',
        properties: {
          course_id: {
            type: 'number',
            description: 'The Canvas course ID',
          },
          search_term: {
            type: 'string',
            description: 'Text to search for in file names',
          },
        },
        required: ['course_id', 'search_term'],
      },
    },
    {
      name: 'canvas_folder_list',
      description: `List all folders in a course.

Returns folder hierarchy:
- Folder names and paths
- Number of files in each folder
- Number of subfolders

Use this to navigate the file structure.`,
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
      name: 'canvas_file_download',
      description: `Download a file from Canvas.

NOTE: Requires browser cookies to be configured.
Canvas blocks file downloads with API tokens only.

Returns:
- Success/failure status
- File data (if successful)
- Error message (if failed)`,
      inputSchema: {
        type: 'object',
        properties: {
          file_url: {
            type: 'string',
            description: 'The file download URL from Canvas',
          },
          file_id: {
            type: 'number',
            description: 'Alternatively, provide file ID to fetch URL first',
          },
        },
      },
    },
  ];
}

/**
 * Handle file tool calls
 */
export async function handleFileTool(
  client: CanvasClient,
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'canvas_file_list':
      return await listFiles(client, args);

    case 'canvas_file_get':
      return await getFile(client, args);

    case 'canvas_file_search':
      return await searchFiles(client, args);

    case 'canvas_folder_list':
      return await listFolders(client, args);

    case 'canvas_file_download':
      return await downloadFile(client, args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown file tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * List all files in a course
 */
async function listFiles(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const sortBy = (args?.sort_by as string) || 'name';

  if (!courseId) {
    return {
      content: [{ type: 'text', text: 'course_id is required' }],
      isError: true,
    };
  }

  const files = await client.listFiles(courseId);

  if (files.length === 0) {
    return {
      content: [{ type: 'text', text: 'No files found in this course.' }],
    };
  }

  // Sort files
  files.sort((a, b) => {
    switch (sortBy) {
      case 'size':
        return b.size - a.size;
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'updated_at':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      default:
        return a.display_name.localeCompare(b.display_name);
    }
  });

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const fileList = files.map((file) => {
    let info = `- **${file.display_name}** (ID: ${file.id})`;
    info += `\n  Size: ${formatFileSize(file.size)} | Type: ${file['content-type']}`;
    info += `\n  Updated: ${new Date(file.updated_at).toLocaleDateString()}`;
    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Course Files\n\n**Total:** ${files.length} files (${formatFileSize(totalSize)})\n\n${fileList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * Get file details
 */
async function getFile(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const fileId = args?.file_id as number;

  if (!fileId) {
    return {
      content: [{ type: 'text', text: 'file_id is required' }],
      isError: true,
    };
  }

  const file = await client.getFile(fileId);

  let details = `# ${file.display_name}\n\n`;
  details += `**File ID:** ${file.id}\n`;
  details += `**Filename:** ${file.filename}\n`;
  details += `**Size:** ${formatFileSize(file.size)}\n`;
  details += `**Content Type:** ${file['content-type']}\n`;
  details += `**Created:** ${new Date(file.created_at).toLocaleString()}\n`;
  details += `**Updated:** ${new Date(file.updated_at).toLocaleString()}\n`;
  details += `\n**Download URL:**\n${file.url}\n`;

  if (file.thumbnail_url) {
    details += `\n**Thumbnail URL:**\n${file.thumbnail_url}\n`;
  }

  // Check if NotebookLLM compatible (under 500KB)
  if (file.size <= 500 * 1024) {
    details += `\n✓ NotebookLLM compatible (under 500KB)`;
  } else {
    details += `\n⚠ May need splitting for NotebookLLM (over 500KB)`;
  }

  return {
    content: [{ type: 'text', text: details }],
  };
}

/**
 * Search for files
 */
async function searchFiles(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const courseId = args?.course_id as number;
  const searchTerm = args?.search_term as string;

  if (!courseId || !searchTerm) {
    return {
      content: [{ type: 'text', text: 'course_id and search_term are required' }],
      isError: true,
    };
  }

  const files = await client.searchFiles(courseId, searchTerm);

  if (files.length === 0) {
    return {
      content: [{ type: 'text', text: `No files found matching "${searchTerm}".` }],
    };
  }

  const fileList = files.map((file) => {
    return `- **${file.display_name}** (ID: ${file.id})\n  Size: ${formatFileSize(file.size)} | Type: ${file['content-type']}`;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Search Results for "${searchTerm}"\n\nFound ${files.length} files:\n\n${fileList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * List folders
 */
async function listFolders(
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

  const folders = await client.listFolders(courseId);

  if (folders.length === 0) {
    return {
      content: [{ type: 'text', text: 'No folders found in this course.' }],
    };
  }

  // Sort by full_name for hierarchy
  folders.sort((a, b) => a.full_name.localeCompare(b.full_name));

  const folderList = folders.map((folder) => {
    let info = `- **${folder.name}** (ID: ${folder.id})`;
    info += `\n  Path: ${folder.full_name}`;
    info += `\n  Files: ${folder.files_count} | Subfolders: ${folder.folders_count}`;
    return info;
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Course Folders\n\nFound ${folders.length} folders:\n\n${folderList.join('\n\n')}`,
      },
    ],
  };
}

/**
 * Download a file
 */
async function downloadFile(
  client: CanvasClient,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  let fileUrl = args?.file_url as string;
  const fileId = args?.file_id as number;

  // If file_id provided, get URL first
  if (!fileUrl && fileId) {
    const file = await client.getFile(fileId);
    fileUrl = file.url;
  }

  if (!fileUrl) {
    return {
      content: [{ type: 'text', text: 'Either file_url or file_id is required' }],
      isError: true,
    };
  }

  // Check cookie status first
  const cookieStatus = client.getCookieStatus();
  if (!cookieStatus.available) {
    return {
      content: [
        {
          type: 'text',
          text: `# Download Failed\n\n**Error:** ${cookieStatus.warning || 'Cookies not configured'}\n\nTo download files from Canvas:\n1. Export cookies from your browser using EditThisCookie or similar\n2. Save as cookies.txt or cookies.json\n3. Set CANVAS_COOKIE_PATH environment variable`,
        },
      ],
      isError: true,
    };
  }

  // Attempt download
  const result = await client.downloadFile(fileUrl);

  if (!result.success) {
    return {
      content: [
        {
          type: 'text',
          text: `# Download Failed\n\n**Error:** ${result.error}\n\nIf cookies have expired, refresh them from your browser.`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `# Download Successful\n\n**Size:** ${formatFileSize(result.data?.byteLength || 0)}\n\nFile data retrieved successfully.`,
      },
    ],
  };
}
