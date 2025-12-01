/**
 * NotebookLM Tools
 * Tools for NotebookLM integration via Playwright automation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

const PYTHON_BRIDGE_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'python-bridge'
);

const PYTHON_EXECUTABLE = path.join(PYTHON_BRIDGE_DIR, 'venv', 'bin', 'python');

/**
 * Execute a Python script and return the JSON result
 */
async function executePythonScript(
  scriptName: string,
  args: string[]
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(PYTHON_BRIDGE_DIR, scriptName);
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [scriptPath, ...args], {
      cwd: PYTHON_BRIDGE_DIR,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve({ success: true, data: result });
      } catch {
        resolve({
          success: false,
          error: `Failed to parse output: ${stdout}`,
        });
      }
    });

    pythonProcess.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to start Python process: ${err.message}`,
      });
    });
  });
}

/**
 * Register NotebookLM-related tools
 */
export function registerNotebookLMTools(): Tool[] {
  return [
    {
      name: 'notebooklm_auth_check',
      description: `Check NotebookLM authentication status.

Returns whether a valid Google authentication session exists.
If not authenticated, you'll need to run notebooklm_auth_setup.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'notebooklm_auth_setup',
      description: `Setup NotebookLM authentication.

IMPORTANT: This requires manual interaction!
- Opens a browser window for Google login
- User must log in to their Google account
- After logging in and seeing NotebookLM, press Enter in the terminal
- Session is saved for future automated use

This only needs to be done once (session persists).`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'notebooklm_list_notebooks',
      description: `List all notebooks in NotebookLM.

Requires authentication (run notebooklm_auth_setup first if needed).

Returns a list of notebook titles.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'notebooklm_upload_sources',
      description: `Upload sources to a NotebookLM notebook.

Uploads website URLs or files to a specified notebook.
Creates the notebook if it doesn't exist.

Source types:
- website: Provide a URL
- file: Provide an absolute file path (PDF, TXT, etc.)

Example sources:
[
  {"type": "website", "value": "https://example.com/article"},
  {"type": "file", "value": "/path/to/document.pdf"}
]

Limits: ~500KB per source, 50-300 sources per notebook.`,
      inputSchema: {
        type: 'object',
        properties: {
          notebook_name: {
            type: 'string',
            description: 'Name of the notebook (created if not exists)',
          },
          sources: {
            type: 'array',
            description: 'Array of sources to upload',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['website', 'file'],
                  description: 'Source type',
                },
                value: {
                  type: 'string',
                  description: 'URL or file path',
                },
              },
              required: ['type', 'value'],
            },
          },
        },
        required: ['notebook_name', 'sources'],
      },
    },
    {
      name: 'notebooklm_prepare_content',
      description: `Prepare content for NotebookLM upload.

Converts and splits content to meet NotebookLM requirements:
- Converts markdown to plain text if needed
- Splits large files into ~400KB chunks (under 500KB limit)
- Creates numbered part files

Returns paths to prepared files ready for upload.`,
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input file',
          },
          output_dir: {
            type: 'string',
            description: 'Directory for output files (default: same as input)',
          },
          max_size_kb: {
            type: 'number',
            description: 'Maximum size per chunk in KB (default: 400)',
          },
        },
        required: ['input_path'],
      },
    },
  ];
}

/**
 * Handle NotebookLM tool calls
 */
export async function handleNotebookLMTool(
  toolName: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case 'notebooklm_auth_check':
      return await checkAuth();

    case 'notebooklm_auth_setup':
      return await setupAuth();

    case 'notebooklm_list_notebooks':
      return await listNotebooks();

    case 'notebooklm_upload_sources':
      return await uploadSources(args);

    case 'notebooklm_prepare_content':
      return await prepareContent(args);

    default:
      return {
        content: [{ type: 'text', text: `Unknown NotebookLM tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * Check authentication status
 */
async function checkAuth(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const result = await executePythonScript('notebooklm_auth.py', ['check']);

  if (!result.success) {
    return {
      content: [{ type: 'text', text: `Error checking auth: ${result.error}` }],
    };
  }

  const data = result.data as {
    authenticated: boolean;
    message: string;
    cookie_count?: number;
  };

  let output = `# NotebookLM Authentication Status\n\n`;
  output += `**Authenticated:** ${data.authenticated ? 'Yes' : 'No'}\n`;
  output += `**Message:** ${data.message}\n`;

  if (data.cookie_count) {
    output += `**Google Cookies:** ${data.cookie_count}\n`;
  }

  if (!data.authenticated) {
    output += `\n## Next Steps\n`;
    output += `Run \`notebooklm_auth_setup\` to authenticate.\n`;
    output += `This will open a browser for Google login.\n`;
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Setup authentication (interactive)
 */
async function setupAuth(): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Note: This is interactive and requires user input
  const result = await executePythonScript('notebooklm_auth.py', ['authenticate']);

  if (!result.success) {
    return {
      content: [
        {
          type: 'text',
          text: `Error during authentication: ${result.error}\n\nMake sure Playwright is installed:\npip install playwright && playwright install chromium`,
        },
      ],
    };
  }

  const data = result.data as { success: boolean; message: string; state_path?: string };

  let output = `# NotebookLM Authentication\n\n`;
  output += `**Status:** ${data.success ? 'Success' : 'Failed'}\n`;
  output += `**Message:** ${data.message}\n`;

  if (data.state_path) {
    output += `**State saved to:** ${data.state_path}\n`;
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * List notebooks
 */
async function listNotebooks(): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  const result = await executePythonScript('notebooklm_upload.py', ['list']);

  if (!result.success) {
    return {
      content: [{ type: 'text', text: `Error listing notebooks: ${result.error}` }],
      isError: true,
    };
  }

  const data = result.data as {
    success: boolean;
    notebooks?: string[];
    count?: number;
    error?: string;
  };

  if (!data.success) {
    return {
      content: [{ type: 'text', text: `NotebookLM error: ${data.error}` }],
      isError: true,
    };
  }

  let output = `# NotebookLM Notebooks\n\n`;
  output += `**Total:** ${data.count || 0}\n\n`;

  if (data.notebooks && data.notebooks.length > 0) {
    for (const notebook of data.notebooks) {
      output += `- ${notebook}\n`;
    }
  } else {
    output += `No notebooks found.\n`;
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Upload sources to a notebook
 */
async function uploadSources(
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const notebookName = args?.notebook_name as string;
  const sources = args?.sources as Array<{ type: string; value: string }>;

  if (!notebookName || !sources || sources.length === 0) {
    return {
      content: [{ type: 'text', text: 'Missing required: notebook_name and sources' }],
      isError: true,
    };
  }

  // Pass sources as JSON string
  const sourcesJson = JSON.stringify(sources);
  const result = await executePythonScript('notebooklm_upload.py', [
    'upload',
    notebookName,
    sourcesJson,
  ]);

  if (!result.success) {
    return {
      content: [{ type: 'text', text: `Error uploading sources: ${result.error}` }],
      isError: true,
    };
  }

  const data = result.data as {
    success: boolean;
    notebook: string;
    uploaded: string[];
    failed: Array<{ value: string; error: string }>;
    error?: string;
  };

  let output = `# NotebookLM Upload Results\n\n`;
  output += `**Notebook:** ${data.notebook}\n\n`;

  if (data.uploaded && data.uploaded.length > 0) {
    output += `## Successfully Uploaded (${data.uploaded.length})\n\n`;
    for (const item of data.uploaded) {
      output += `- ${item}\n`;
    }
    output += '\n';
  }

  if (data.failed && data.failed.length > 0) {
    output += `## Failed (${data.failed.length})\n\n`;
    for (const item of data.failed) {
      output += `- ${item.value}: ${item.error}\n`;
    }
    output += '\n';
  }

  if (data.error) {
    output += `\n**Error:** ${data.error}\n`;
  }

  return {
    content: [{ type: 'text', text: output }],
    isError: !data.success,
  };
}

/**
 * Prepare content for NotebookLM (split large files, convert formats)
 */
async function prepareContent(
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const inputPath = args?.input_path as string;
  const outputDir = (args?.output_dir as string) || path.dirname(inputPath);
  const maxSizeKb = (args?.max_size_kb as number) || 400;

  if (!inputPath) {
    return {
      content: [{ type: 'text', text: 'Missing required: input_path' }],
      isError: true,
    };
  }

  try {
    // Check if file exists
    const stats = await fs.stat(inputPath);
    const fileSizeKb = stats.size / 1024;
    const fileName = path.basename(inputPath);
    const fileExt = path.extname(inputPath);
    const baseName = path.basename(inputPath, fileExt);

    // Read file content
    let content = await fs.readFile(inputPath, 'utf-8');

    // Convert markdown to plain text (basic conversion)
    if (fileExt === '.md' || fileExt === '.markdown') {
      content = convertMarkdownToText(content);
    }

    const preparedFiles: string[] = [];

    if (fileSizeKb <= maxSizeKb) {
      // File is small enough, just save it
      const outputPath = path.join(outputDir, `${baseName}_prepared.txt`);
      await fs.writeFile(outputPath, content);
      preparedFiles.push(outputPath);
    } else {
      // Split into chunks
      const chunks = splitContentIntoChunks(content, maxSizeKb * 1024);

      for (let i = 0; i < chunks.length; i++) {
        const outputPath = path.join(outputDir, `${baseName}_part${i + 1}.txt`);
        await fs.writeFile(outputPath, chunks[i]);
        preparedFiles.push(outputPath);
      }
    }

    let output = `# Content Prepared for NotebookLM\n\n`;
    output += `**Input:** ${fileName}\n`;
    output += `**Original Size:** ${fileSizeKb.toFixed(1)} KB\n`;
    output += `**Max Chunk Size:** ${maxSizeKb} KB\n`;
    output += `**Files Created:** ${preparedFiles.length}\n\n`;

    output += `## Output Files\n\n`;
    for (const file of preparedFiles) {
      const fileStats = await fs.stat(file);
      output += `- ${path.basename(file)} (${(fileStats.size / 1024).toFixed(1)} KB)\n`;
    }

    output += `\n## Next Step\n`;
    output += `Use \`notebooklm_upload_sources\` with these files:\n\n`;
    output += '```json\n';
    output += JSON.stringify(
      preparedFiles.map((f) => ({ type: 'file', value: f })),
      null,
      2
    );
    output += '\n```\n';

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error preparing content: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Basic markdown to text conversion
 */
function convertMarkdownToText(markdown: string): string {
  let text = markdown;

  // Remove code blocks (keep content)
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
  });

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Convert headers to plain text with separator
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n' + '='.repeat(40) + '\n');

  // Remove bold/italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // Convert links to text with URL
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Remove images (keep alt text)
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]');

  // Convert bullet lists
  text = text.replace(/^[\*\-]\s+/gm, '- ');

  // Convert numbered lists (keep as is)
  text = text.replace(/^\d+\.\s+/gm, (match) => match);

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}$/gm, '\n---\n');

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Split content into chunks by size
 */
function splitContentIntoChunks(content: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

    if (Buffer.byteLength(potentialChunk, 'utf-8') > maxBytes && currentChunk) {
      // Current chunk is full, save it and start new one
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
