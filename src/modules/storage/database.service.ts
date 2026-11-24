import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';

export interface SavedPropertyRow {
  id: string;
  user_id: string;
  property_id: string;
  canonical_name: string;
  created_at: string;
}

export interface ViewingBookingRow {
  id: string;
  user_id: string;
  property_id: string;
  canonical_name: string;
  buyer_name: string;
  buyer_contact: string;
  preferred_date: string;
  notes: string;
  status: string;
  created_at: string;
}

export interface ChatTurnRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  trace_id: string | null;
  top_property_id: string | null;
  created_at: string;
}

export interface AuditTraceRow {
  trace_id: string;
  session_id: string;
  query: string;
  model_used: string;
  latency_ms: number;
  cost_usd: number;
  faithfulness: number;
  self_healed: number;
  created_at: string;
}

/**
 * Real SQLite Persistence Layer (WAL mode via Node 22+ native node:sqlite).
 * Persists:
 *   - User Saved Homes Shortlist (saved_properties)
 *   - Buyer Private Viewing Bookings & Paid Forensic Dossier Orders (viewing_bookings)
 *   - Multi-Turn Conversational Advisor History (chat_turns)
 *   - Production Langfuse / MLOps Trace History & Funnel Events (audit_traces, funnel_events)
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly db: DatabaseSync;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'estatetruth.sqlite');

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
    this.logger.log(`SQLite WAL persistence ready at ${dbPath}`);
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_properties (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, property_id)
      );

      CREATE TABLE IF NOT EXISTS viewing_bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        buyer_contact TEXT NOT NULL,
        preferred_date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'CONFIRMED_CONCIERGE',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS unlocked_dossiers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, property_id)
      );

      CREATE TABLE IF NOT EXISTS chat_turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        trace_id TEXT,
        top_property_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_traces (
        trace_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        query TEXT NOT NULL,
        model_used TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        faithfulness REAL NOT NULL,
        self_healed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS funnel_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        session_id TEXT NOT NULL,
        trace_id TEXT,
        property_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_cache (
        cache_key TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS discovered_properties (
        id TEXT PRIMARY KEY,
        canonical_name TEXT NOT NULL,
        city TEXT NOT NULL,
        micro_market TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  // --- Multi-Tier L2 Persistent SQLite Cache ---
  getCached<T>(key: string): T | null {
    try {
      const row = this.db
        .prepare('SELECT payload_json, expires_at FROM api_cache WHERE cache_key = ?')
        .get(key) as { payload_json: string; expires_at: number } | undefined;
      if (!row) return null;
      if (Date.now() > Number(row.expires_at)) {
        this.db.prepare('DELETE FROM api_cache WHERE cache_key = ?').run(key);
        return null;
      }
      this.db.prepare('UPDATE api_cache SET hit_count = hit_count + 1 WHERE cache_key = ?').run(key);
      return JSON.parse(row.payload_json) as T;
    } catch {
      return null;
    }
  }

  setCached(key: string, category: string, payload: unknown, ttlSeconds: number) {
    try {
      const now = Date.now();
      const expiresAt = now + ttlSeconds * 1000;
      this.db
        .prepare(
          `INSERT INTO api_cache (cache_key, category, payload_json, created_at, expires_at, hit_count)
           VALUES (?, ?, ?, ?, ?, 0)
           ON CONFLICT(cache_key) DO UPDATE SET
             payload_json = excluded.payload_json,
             created_at = excluded.created_at,
             expires_at = excluded.expires_at`
        )
        .run(key, category, JSON.stringify(payload), now, expiresAt);
    } catch {
      // ignore
    }
  }

  getCacheStats() {
    try {
      const rows = this.db
        .prepare(
          `SELECT category, COUNT(*) as entries, COALESCE(SUM(hit_count), 0) as total_hits
           FROM api_cache WHERE expires_at > ? GROUP BY category`
        )
        .all(Date.now()) as unknown as Array<{ category: string; entries: number; total_hits: number }>;
      const totalEntries = rows.reduce((a, r) => a + Number(r.entries), 0);
      const totalHits = rows.reduce((a, r) => a + Number(r.total_hits), 0);
      return { totalEntries, totalHits, byCategory: rows };
    } catch {
      return { totalEntries: 0, totalHits: 0, byCategory: [] };
    }
  }

  // --- Live Discovered Real Properties (OpenStreetMap + Open-Meteo + RERA/DLD Ingestion) ---
  saveDiscoveredProperty(prop: { id: string; canonicalName: string; city: string; microMarket: string } & Record<string, unknown>) {
    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO discovered_properties (id, canonical_name, city, micro_market, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(prop.id, prop.canonicalName, prop.city, prop.microMarket, JSON.stringify(prop), new Date().toISOString());
    } catch {
      // ignore
    }
  }

  listDiscoveredProperties<T>(): T[] {
    try {
      const rows = this.db
        .prepare('SELECT payload_json FROM discovered_properties ORDER BY created_at DESC LIMIT 100')
        .all() as unknown as Array<{ payload_json: string }>;
      return rows.map((r) => JSON.parse(r.payload_json) as T);
    } catch {
      return [];
    }
  }

  // --- Saved Shortlist ---
  toggleSavedProperty(userId: string, propertyId: string, canonicalName: string): { saved: boolean } {
    const existing = this.db
      .prepare('SELECT id FROM saved_properties WHERE user_id = ? AND property_id = ?')
      .get(userId, propertyId) as { id: string } | undefined;

    if (existing) {
      this.db.prepare('DELETE FROM saved_properties WHERE id = ?').run(existing.id);
      return { saved: false };
    }

    const id = `sav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare('INSERT INTO saved_properties (id, user_id, property_id, canonical_name, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, propertyId, canonicalName, new Date().toISOString());
    return { saved: true };
  }

  listSavedProperties(userId: string): SavedPropertyRow[] {
    return this.db
      .prepare('SELECT * FROM saved_properties WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as SavedPropertyRow[];
  }

  // --- Paid Forensic Dossiers ---
  unlockDossier(userId: string, propertyId: string) {
    const id = `dos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare('INSERT OR IGNORE INTO unlocked_dossiers (id, user_id, property_id, created_at) VALUES (?, ?, ?, ?)')
      .run(id, userId, propertyId, new Date().toISOString());
    return { unlocked: true, propertyId };
  }

  listUnlockedDossiers(userId: string): string[] {
    const rows = this.db
      .prepare('SELECT property_id FROM unlocked_dossiers WHERE user_id = ?')
      .all(userId) as unknown as Array<{ property_id: string }>;
    return rows.map((r) => r.property_id);
  }

  // --- Private Viewing Bookings ---
  createBooking(input: {
    userId: string;
    propertyId: string;
    canonicalName: string;
    buyerName: string;
    buyerContact: string;
    preferredDate: string;
    notes?: string;
  }): ViewingBookingRow {
    const id = `bk_${Date.now().toString(36).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO viewing_bookings (id, user_id, property_id, canonical_name, buyer_name, buyer_contact, preferred_date, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED_CONCIERGE', ?)`
      )
      .run(
        id,
        input.userId,
        input.propertyId,
        input.canonicalName,
        input.buyerName,
        input.buyerContact,
        input.preferredDate,
        input.notes || '',
        createdAt
      );

    return {
      id,
      user_id: input.userId,
      property_id: input.propertyId,
      canonical_name: input.canonicalName,
      buyer_name: input.buyerName,
      buyer_contact: input.buyerContact,
      preferred_date: input.preferredDate,
      notes: input.notes || '',
      status: 'CONFIRMED_CONCIERGE',
      created_at: createdAt,
    };
  }

  listBookings(userId: string): ViewingBookingRow[] {
    return this.db
      .prepare('SELECT * FROM viewing_bookings WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as ViewingBookingRow[];
  }

  // --- Multi-Turn Chat Memory ---
  appendChatTurn(turn: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    traceId?: string;
    topPropertyId?: string;
  }) {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare(
        'INSERT INTO chat_turns (id, session_id, role, content, trace_id, top_property_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        turn.sessionId,
        turn.role,
        turn.content,
        turn.traceId || null,
        turn.topPropertyId || null,
        new Date().toISOString()
      );
  }

  getChatHistory(sessionId: string, limit = 10): ChatTurnRow[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_turns WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(sessionId, limit) as unknown as ChatTurnRow[];
    return rows.reverse();
  }

  // --- Audit Traces & Funnel Events ---
  saveTrace(row: Omit<AuditTraceRow, 'created_at'>) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO audit_traces (trace_id, session_id, query, model_used, latency_ms, cost_usd, faithfulness, self_healed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.trace_id,
        row.session_id,
        row.query,
        row.model_used,
        row.latency_ms,
        row.cost_usd,
        row.faithfulness,
        row.self_healed,
        new Date().toISOString()
      );
  }

  getRecentTraces(limit = 25): AuditTraceRow[] {
    return this.db
      .prepare('SELECT * FROM audit_traces ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as AuditTraceRow[];
  }

  recordFunnelEvent(eventType: string, sessionId: string, traceId?: string, propertyId?: string) {
    const id = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare(
        'INSERT INTO funnel_events (id, event_type, session_id, trace_id, property_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, eventType, sessionId, traceId || null, propertyId || null, new Date().toISOString());
  }

  getFunnelCounts(): Record<string, number> {
    const rows = this.db
      .prepare('SELECT event_type, COUNT(*) as cnt FROM funnel_events GROUP BY event_type')
      .all() as unknown as Array<{ event_type: string; cnt: number }>;
    const map: Record<string, number> = {};
    for (const r of rows) map[r.event_type] = Number(r.cnt);
    return map;
  }
}
