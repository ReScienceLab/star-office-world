/**
 * Star Office World — Server-Sent Events manager
 *
 * Manages SSE connections to browser clients and broadcasts events.
 */

import type { FastifyReply } from "fastify";
import type { SSEEventType } from "./types.js";

interface SSEClient {
  id: string;
  reply: FastifyReply;
  connectedAt: number;
}

export class SSEManager {
  private clients = new Map<string, SSEClient>();
  private nextId = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(heartbeatIntervalMs = 30_000) {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast("heartbeat", {});
    }, heartbeatIntervalMs);
  }

  /**
   * Register a new SSE client. Caller must send appropriate headers first.
   */
  addClient(reply: FastifyReply): string {
    const id = `sse_${++this.nextId}_${Date.now()}`;
    this.clients.set(id, { id, reply, connectedAt: Date.now() });

    // Clean up when connection closes
    reply.raw.on("close", () => {
      this.clients.delete(id);
    });

    return id;
  }

  /**
   * Send a typed event to all connected clients.
   */
  broadcast(event: SSEEventType, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients) {
      try {
        client.reply.raw.write(payload);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  /**
   * Send a typed event to a single client.
   */
  sendTo(clientId: string, event: SSEEventType, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.reply.raw.write(payload);
    } catch {
      this.clients.delete(clientId);
    }
  }

  get size(): number {
    return this.clients.size;
  }

  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const client of this.clients.values()) {
      try {
        client.reply.raw.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
