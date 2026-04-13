/**
 * WhatsApp Client Registry
 *
 * Global registry to track all active Baileys WASocket instances.
 * Used by the self-message listener to access connected sockets.
 */

import type { WASocket } from "@whiskeysockets/baileys";

// Module instance ID to detect if the module is being re-imported
const MODULE_ID = Math.random().toString(36).slice(2, 8);

class WhatsAppClientRegistry {
  private clients: Map<string, WASocket> = new Map();

  /**
   * Register a socket for a specific account. Idempotent — if a socket is already
   * registered for this accountId, skip the registration to avoid overwriting the
   * existing socket (which may be owned by the self-listener).
   */
  register(accountId: string, sock: WASocket): void {
    const existing = this.clients.get(accountId);
    if (existing && existing !== sock) {
      console.log(
        `[WhatsAppClientRegistry] SKIP REGISTER: accountId=${accountId} already has socket (new sock.user=${sock.user?.id}, existing sock.user=${existing.user?.id}), not overwriting`,
      );
      return;
    }
    this.clients.set(accountId, sock);
  }

  /**
   * Unregister a socket
   */
  unregister(accountId: string): void {
    console.log(
      `[WhatsAppClientRegistry] UNREGISTER instance=${MODULE_ID} accountId=${accountId} (before keys=${[...this.clients.keys()]})`,
    );
    this.clients.delete(accountId);
  }

  /**
   * Get a socket by account ID
   */
  get(accountId: string): WASocket | undefined {
    const result = this.clients.get(accountId);
    return result;
  }

  /**
   * Get all registered sockets
   */
  getAll(): Map<string, WASocket> {
    return new Map(this.clients);
  }

  /**
   * Check if a socket is registered
   */
  has(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  /**
   * Clear all sockets
   */
  clear(): void {
    this.clients.clear();
  }
}

// Export singleton instance
export const whatsappClientRegistry = new WhatsAppClientRegistry();
