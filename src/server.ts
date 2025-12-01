/**
 * Canvas MCP Server
 * Model Context Protocol server for Canvas LMS
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { CanvasClient } from './core/client.js';

// Phase 1: Core tools
import { registerCourseTools, handleCourseTool } from './tools/courses.js';
import { registerAssignmentTools, handleAssignmentTool } from './tools/assignments.js';

// Phase 2: Content tools
import { registerModuleTools, handleModuleTool } from './tools/modules.js';
import { registerFileTools, handleFileTool } from './tools/files.js';
import { registerDiscussionTools, handleDiscussionTool } from './tools/discussions.js';
import { registerPlannerTools, handlePlannerTool } from './tools/planner.js';

// Phase 3: Assessment tools
import { registerRubricTools, handleRubricTool } from './tools/rubrics.js';
import { registerQuizTools, handleQuizTool } from './tools/quizzes.js';
import { registerGroupTools, handleGroupTool } from './tools/groups.js';

// Phase 4: User tools
import { registerBookmarkTools, handleBookmarkTool } from './tools/bookmarks.js';
import { registerCommunicationTools, handleCommunicationTool } from './tools/communication.js';
import { registerDashboardTools, handleDashboardTool } from './tools/dashboard.js';

// Phase 5: NotebookLM integration
import { registerNotebookLMTools, handleNotebookLMTool } from './tools/notebooklm.js';

export class CanvasMcpServer {
  private server: Server;
  private client: CanvasClient;

  constructor() {
    const baseUrl = process.env.CANVAS_BASE_URL;
    if (!baseUrl) {
      throw new Error('CANVAS_BASE_URL environment variable not set');
    }

    this.client = new CanvasClient({ baseUrl });

    this.server = new Server(
      {
        name: 'canvas-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        // Phase 1: Core
        ...registerCourseTools(),
        ...registerAssignmentTools(),
        // Phase 2: Content
        ...registerModuleTools(),
        ...registerFileTools(),
        ...registerDiscussionTools(),
        ...registerPlannerTools(),
        // Phase 3: Assessment
        ...registerRubricTools(),
        ...registerQuizTools(),
        ...registerGroupTools(),
        // Phase 4: User
        ...registerBookmarkTools(),
        ...registerCommunicationTools(),
        ...registerDashboardTools(),
        // Phase 5: NotebookLM
        ...registerNotebookLMTools(),
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route to appropriate handler based on tool name prefix

        // Phase 1: Core
        if (name.startsWith('canvas_course')) {
          return await handleCourseTool(this.client, name, args);
        }

        if (name.startsWith('canvas_assignment') || name === 'canvas_get_my_submission') {
          return await handleAssignmentTool(this.client, name, args);
        }

        // Phase 2: Content
        if (name.startsWith('canvas_module')) {
          return await handleModuleTool(this.client, name, args);
        }

        if (name.startsWith('canvas_file') || name.startsWith('canvas_folder')) {
          return await handleFileTool(this.client, name, args);
        }

        if (name.startsWith('canvas_discussion') || name.startsWith('canvas_announcement')) {
          return await handleDiscussionTool(this.client, name, args);
        }

        if (name.startsWith('canvas_planner') || name.startsWith('canvas_todo') ||
            name.startsWith('canvas_upcoming') || name.startsWith('canvas_missing')) {
          return await handlePlannerTool(this.client, name, args);
        }

        // Phase 3: Assessment
        if (name.startsWith('canvas_rubric')) {
          return await handleRubricTool(this.client, name, args);
        }

        if (name.startsWith('canvas_quiz')) {
          return await handleQuizTool(this.client, name, args);
        }

        if (name.startsWith('canvas_group')) {
          return await handleGroupTool(this.client, name, args);
        }

        // Phase 4: User
        if (name.startsWith('canvas_bookmark')) {
          return await handleBookmarkTool(this.client, name, args);
        }

        if (name.startsWith('canvas_inbox') || name.startsWith('canvas_notification')) {
          return await handleCommunicationTool(this.client, name, args);
        }

        if (name.startsWith('canvas_dashboard') || name.startsWith('canvas_profile') ||
            name.startsWith('canvas_grades') || name.startsWith('canvas_cache')) {
          return await handleDashboardTool(this.client, name, args);
        }

        // Phase 5: NotebookLM (no Canvas client needed)
        if (name.startsWith('notebooklm_')) {
          return await handleNotebookLMTool(name, args);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // List resources (for future expansion)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });

    // Read resource (for future expansion)
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: 'Resource not found',
          },
        ],
      };
    });

    // List prompts (for future expansion)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: [] };
    });

    // Get prompt (for future expansion)
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Prompt ${request.params.name} not found`,
            },
          },
        ],
      };
    });

    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Canvas MCP Server running on stdio');
  }
}
