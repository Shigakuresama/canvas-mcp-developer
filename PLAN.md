# Canvas LMS MCP Server - Implementation Plan

## Overview

Build a comprehensive TypeScript MCP server for Canvas LMS that provides read-only access to courses, assignments, submissions, modules, files, and grades. Integrates with existing Python downloader scripts and supports NotebookLLM study workflow.

**User:** Sergio Correa Martinengo (student at rsccd.instructure.com)
**User ID:** 380601 | **Primary Course:** CMPR158 (ID: 134472)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Canvas MCP Server (TypeScript)               │
├─────────────────────────────────────────────────────────────────┤
│  Tools (74)           │  Resources (10)      │  Prompts (5)     │
│  - Courses (6)        │  - User profile      │  - Dashboard     │
│  - Assignments (6)    │  - Active courses    │  - Weekly digest │
│  - Submissions (6)    │  - Due dates         │  - Exam prep     │
│  - Modules (6)        │  - Grades overview   │  - Sync guide    │
│  - Files (5)          │  - Announcements     │  - Course summary│
│  - Discussions (5)    │                      │                  │
│  - Planner (4)        │                      │                  │
│  - Dashboard (3)      │                      │                  │
│  - NotebookLLM (8)    │                      │                  │
│  - Communication (4)  │                      │                  │
│  - + More...          │                      │                  │
├─────────────────────────────────────────────────────────────────┤
│  Core Services                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Canvas Client│ │ Memory Cache │ │ Python Bridge            │ │
│  │ (fetch)      │ │ (5-30m TTL)  │ │ (spawn existing scripts) │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Auth: API Token (primary) + Cookie file (file downloads only)  │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Strategy

**API Token = PRIMARY (All API Operations)**
- Official, documented, Canvas-compliant authentication
- Stable - doesn't expire until manually revoked
- Works for ALL metadata: courses, assignments, submissions, grades, modules, discussions, etc.
- Set via `Authorization: Bearer {token}` header

**Cookies = SECONDARY (File Downloads ONLY)**
- Only used for `download_file` tool
- Reason: Canvas returns 403 Forbidden when downloading files (PDF, DOCX, PPTX) with API token
- This is an undocumented Canvas limitation, NOT in official API docs
- Expires in ~24h, requires manual browser cookie export
- Optional - server works without cookies (just can't download files)

## Tool Count Summary (74 Total)

| Category | Count | Status |
|----------|-------|--------|
| Course Tools | 6 | Core |
| Assignment Tools | 6 | Core |
| Submission & Grades | 6 | Core |
| Module & Content | 6 | Core |
| File Tools | 5 | Core |
| Discussion & Announcements | 5 | Core |
| Planner & TODO | 4 | Core |
| Rubric Tools | 2 | Core |
| Quiz Tools | 3 | Core |
| Groups & Collaboration | 2 | Core |
| Bookmarks Tools | 3 | Enhanced |
| Dashboard Tools | 3 | Enhanced |
| NotebookLLM Integration | 8 | Enhanced |
| Communication Tools | 4 | NEW |
| Notifications & Appointments | 4 | NEW |
| User & Export Tools | 4 | NEW |
| Workflow Optimization | 3 | NEW |
| **Total** | **74** | |

## Implementation Phases

### Phase 1: Core Foundation
- [x] Project setup (package.json, tsconfig, structure)
- [ ] Canvas client with API token auth
- [ ] Cookie support for file downloads
- [ ] Pagination helper (Link header parsing)
- [ ] Memory cache with TTL
- [ ] Rate limiter
- [ ] MCP server setup with tool registration
- [ ] 5 core tools: list_courses, get_course, list_assignments, get_assignment, get_my_submission

### Phase 2: Student Essentials
- [ ] Module tools (6)
- [ ] Remaining assignment tools
- [ ] Submission tools (5)
- [ ] File tools (5)
- [ ] Discussion tools (5)

### Phase 3: Smart Features
- [ ] Planner/TODO tools (4)
- [ ] Dashboard aggregation tools (3)
- [ ] Rubric tools (2)
- [ ] Quiz tools (3)

### Phase 4: Communication & Enhanced
- [ ] Communication tools (4)
- [ ] Notifications & Appointments (4)
- [ ] User & Export tools (4)
- [ ] Groups & Bookmarks (5)

### Phase 5: NotebookLLM & Workflow
- [ ] NotebookLLM integration tools (8)
- [ ] Workflow optimization tools (3)
- [ ] Python bridge for sync
- [ ] MCP resources (10)

### Phase 6: Polish
- [ ] Error handling refinement
- [ ] Documentation
- [ ] Testing
- [ ] Claude Code configuration

## Configuration

### Environment Variables
```bash
CANVAS_BASE_URL=https://rsccd.instructure.com
CANVAS_API_TOKEN=5363~...
CANVAS_COOKIE_PATH=/home/sergiodev/projects/canvas-automation-complete/cookies.txt
CANVAS_USER_ID=380601
CANVAS_MATERIALS_DIR=/home/sergiodev/notebooklm_materials
```

### Claude Settings (mcpServers)
```json
{
  "canvas-lms": {
    "command": "node",
    "args": ["/home/sergiodev/projects/canvas-mcp-server/dist/index.js"],
    "env": {
      "CANVAS_BASE_URL": "https://rsccd.instructure.com",
      "CANVAS_COOKIE_PATH": "cookies.txt"
    }
  }
}
```

## Success Criteria

### Core Requirements
- [ ] All 74 tools implemented and working
- [ ] API token as PRIMARY authentication (required)
- [ ] Cookie support for file downloads only (optional, with >16h age warning)
- [ ] Memory cache reducing API calls (5-30 min TTL)
- [ ] Configured in Claude Code settings

### Enhanced Features
- [ ] Communication tools - Conversations, messaging, unread count
- [ ] Appointment booking - Office hours scheduling via Canvas
- [ ] Smart sync - Only download changed materials (80% bandwidth savings)
- [ ] NotebookLLM optimization - Markdown conversion (+30% podcast quality)
- [ ] Python bridge for NotebookLLM sync (spawn existing scripts)
- [ ] 10 MCP resources providing context
