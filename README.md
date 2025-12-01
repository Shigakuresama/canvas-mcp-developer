# Canvas MCP Server

A Model Context Protocol (MCP) server providing read-only access to Canvas LMS for student workflows, with optional NotebookLM integration for study material organization.

## Features

- **45 Tools** covering Canvas LMS functionality
- **Read-only access** - Safe for student use
- **Smart caching** - Reduces API calls
- **Rate limiting** - Respects Canvas API limits (~3000 req/hour)
- **NotebookLM integration** - Upload course content for AI-powered study

## Quick Start

### 1. Install Dependencies

```bash
npm install
npm run build
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Canvas credentials
```

Required settings:
- `CANVAS_BASE_URL` - Your Canvas instance URL
- `CANVAS_API_TOKEN` - Generate at Canvas > Account > Settings > New Access Token

### 3. Add to Claude Code

Add to your Claude Code MCP configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/canvas-mcp-server",
      "env": {
        "CANVAS_BASE_URL": "https://your-school.instructure.com",
        "CANVAS_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

### 4. (Optional) Setup NotebookLM

For NotebookLM integration:

```bash
cd src/python-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Then use `notebooklm_auth_setup` tool for interactive Google login.

## Available Tools (45 total)

### Phase 1: Core (5 tools)
| Tool | Description |
|------|-------------|
| `canvas_course_list` | List enrolled courses |
| `canvas_course_get` | Get course details |
| `canvas_assignment_list` | List assignments (with bucket filtering) |
| `canvas_assignment_get` | Get assignment details |
| `canvas_get_my_submission` | Get your submission for an assignment |

### Phase 2: Content (16 tools)
| Tool | Description |
|------|-------------|
| `canvas_module_list` | List course modules |
| `canvas_module_get` | Get module details |
| `canvas_module_items` | List items in a module |
| `canvas_module_progress` | Get module completion progress |
| `canvas_file_list` | List files in a folder |
| `canvas_file_get` | Get file metadata |
| `canvas_file_search` | Search for files |
| `canvas_folder_list` | List folders |
| `canvas_file_download` | Download file content |
| `canvas_discussion_list` | List discussions |
| `canvas_discussion_get` | Get discussion with replies |
| `canvas_announcement_list` | List announcements |
| `canvas_planner_items` | Get planner items |
| `canvas_todo_list` | Get todo items |
| `canvas_upcoming_events` | Get upcoming events |
| `canvas_missing_submissions` | Get missing assignments |

### Phase 3: Assessment (8 tools)
| Tool | Description |
|------|-------------|
| `canvas_rubric_list` | List rubrics in a course |
| `canvas_rubric_get` | Get rubric details |
| `canvas_rubric_for_assignment` | Get rubric for an assignment |
| `canvas_quiz_list` | List quizzes |
| `canvas_quiz_get` | Get quiz details |
| `canvas_quiz_submission` | Get your quiz submission |
| `canvas_group_list` | List your groups |
| `canvas_group_members` | List group members |

### Phase 4: User (11 tools)
| Tool | Description |
|------|-------------|
| `canvas_bookmark_list` | List your bookmarks |
| `canvas_bookmark_create` | Create a bookmark |
| `canvas_bookmark_delete` | Delete a bookmark |
| `canvas_inbox_list` | List inbox messages |
| `canvas_inbox_get` | Get conversation details |
| `canvas_inbox_unread_count` | Get unread message count |
| `canvas_notification_list` | List notifications |
| `canvas_dashboard` | Comprehensive dashboard view |
| `canvas_profile` | Get your profile |
| `canvas_grades_overview` | Get grades across courses |
| `canvas_cache_status` | View/clear cache |

### Phase 5: NotebookLM (5 tools)
| Tool | Description |
|------|-------------|
| `notebooklm_auth_check` | Check Google auth status |
| `notebooklm_auth_setup` | Interactive Google login |
| `notebooklm_list_notebooks` | List NotebookLM notebooks |
| `notebooklm_upload_sources` | Upload sources to notebook |
| `notebooklm_prepare_content` | Convert/split files for upload |

## Authentication

### Canvas API (Primary)
- **API Token**: Required for all API calls
- Generate at: Canvas > Account > Settings > New Access Token
- Provides access to your enrolled courses, assignments, grades, etc.

### Cookies (Secondary, Optional)
- Only needed if file downloads return 403 errors
- Export browser cookies using extensions like "Get cookies.txt"
- Set `CANVAS_COOKIES_FILE` in your environment

### NotebookLM (Interactive)
- Uses Playwright browser automation (no public API exists)
- Run `notebooklm_auth_setup` once to save Google session
- Session persists in `src/python-bridge/state.json`

## Architecture

```
canvas-mcp-server/
├── src/
│   ├── core/
│   │   ├── auth.ts        # Token + cookie authentication
│   │   ├── cache.ts       # Memory cache with TTL
│   │   ├── client.ts      # Canvas API client
│   │   ├── pagination.ts  # Link header parsing
│   │   └── rate-limiter.ts # Token bucket rate limiter
│   ├── tools/
│   │   ├── courses.ts     # Course tools
│   │   ├── assignments.ts # Assignment tools
│   │   ├── modules.ts     # Module tools
│   │   ├── files.ts       # File tools
│   │   ├── discussions.ts # Discussion tools
│   │   ├── planner.ts     # Planner tools
│   │   ├── rubrics.ts     # Rubric tools
│   │   ├── quizzes.ts     # Quiz tools
│   │   ├── groups.ts      # Group tools
│   │   ├── bookmarks.ts   # Bookmark tools
│   │   ├── communication.ts # Inbox/notification tools
│   │   ├── dashboard.ts   # Dashboard tools
│   │   └── notebooklm.ts  # NotebookLM tools
│   ├── python-bridge/
│   │   ├── notebooklm_auth.py   # Google auth management
│   │   ├── notebooklm_upload.py # Source upload automation
│   │   └── requirements.txt     # Python dependencies
│   ├── types/
│   │   └── canvas.ts      # TypeScript types
│   ├── server.ts          # MCP server
│   └── index.ts           # Entry point
├── .env.example           # Environment template
├── mcp.json               # MCP configuration
└── package.json
```

## Rate Limits

Canvas API allows ~3000 requests per hour. This server implements:
- Token bucket rate limiter (0.8 req/sec default)
- Smart caching (5-30 min TTL per resource type)
- Automatic retry with backoff on 429 responses

## License

MIT
