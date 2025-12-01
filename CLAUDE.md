# Canvas MCP Server

## Project Overview

A Model Context Protocol (MCP) server providing read-only access to Canvas LMS for student workflows. Includes optional NotebookLM integration via Playwright browser automation.

## Architecture

### Core Components (`src/core/`)
- **client.ts** - Main Canvas API client with 40+ methods
- **auth.ts** - API token (primary) + cookie (secondary for file downloads) authentication
- **cache.ts** - Memory cache with configurable TTL per resource type
- **pagination.ts** - Canvas Link header parsing for paginated responses
- **rate-limiter.ts** - Token bucket rate limiter (~3000 req/hour)

### Tools (`src/tools/`) - 45 total
| File | Tools | Prefix |
|------|-------|--------|
| courses.ts | 2 | `canvas_course_` |
| assignments.ts | 3 | `canvas_assignment_`, `canvas_get_my_submission` |
| modules.ts | 4 | `canvas_module_` |
| files.ts | 5 | `canvas_file_`, `canvas_folder_` |
| discussions.ts | 3 | `canvas_discussion_`, `canvas_announcement_` |
| planner.ts | 4 | `canvas_planner_`, `canvas_todo_`, `canvas_upcoming_`, `canvas_missing_` |
| rubrics.ts | 3 | `canvas_rubric_` |
| quizzes.ts | 3 | `canvas_quiz_` |
| groups.ts | 2 | `canvas_group_` |
| bookmarks.ts | 3 | `canvas_bookmark_` |
| communication.ts | 4 | `canvas_inbox_`, `canvas_notification_` |
| dashboard.ts | 4 | `canvas_dashboard`, `canvas_profile`, `canvas_grades_`, `canvas_cache_` |
| notebooklm.ts | 5 | `notebooklm_` |

### Python Bridge (`src/python-bridge/`)
- **notebooklm_auth.py** - Google authentication state management
- **notebooklm_upload.py** - Playwright-based source upload automation
- **venv/** - Python virtual environment with Playwright

## Key Patterns

### Tool Registration
Each tool file exports:
```typescript
export function registerXxxTools(): Tool[]  // Returns tool definitions
export async function handleXxxTool(client, name, args)  // Handles tool calls
```

### API Client Pattern
```typescript
// All Canvas API methods follow this pattern:
async methodName(params): Promise<Type> {
  return this.request<Type>('/api/v1/endpoint', { params });
}
```

### Canvas API Conventions
- Base URL: `${CANVAS_BASE_URL}/api/v1/`
- Auth header: `Authorization: Bearer ${token}`
- Pagination: `Link` header with `rel="next"` URLs
- Rate limit: X-Rate-Limit headers, 429 on throttle

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| CANVAS_BASE_URL | Yes | Canvas instance URL |
| CANVAS_API_TOKEN | Yes | API access token |
| CANVAS_COOKIES_FILE | No | For file downloads |

## Commands

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run tests
```

## Common Tasks

### Adding a New Canvas Tool
1. Add method to `src/core/client.ts`
2. Add type to `src/types/canvas.ts` if needed
3. Create/update tool file in `src/tools/`
4. Register in `src/server.ts` (import, register, handle)

### Testing Canvas API Calls
```bash
# Set environment
export CANVAS_BASE_URL=https://your-school.instructure.com
export CANVAS_API_TOKEN=your_token

# Run server
node dist/index.js
```

## Important Notes

- **Read-only**: This server only reads data, never writes/modifies
- **Student-focused**: Tools designed for student workflows
- **Caching**: Most responses cached 5-30 minutes
- **NotebookLM**: No public API - uses Playwright automation
