#!/usr/bin/env node
/**
 * Canvas MCP Server Entry Point
 */

import { CanvasMcpServer } from './server.js';

async function main(): Promise<void> {
  try {
    const server = new CanvasMcpServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start Canvas MCP Server:', error);
    process.exit(1);
  }
}

main();
