/**
 * Cloud database migration script
 * Migrates data from cloud PostgreSQL to local SQLite database
 *
 * Supports two modes:
 * 1. dump mode: Read data from cloud and export to JSON file
 * 2. load mode: Read data from JSON file and write to local SQLite
 *
 * Migration content: bots, insights, integrations, contacts
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { config } from "dotenv";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema-sqlite";
import type { Bot, Insight, IntegrationAccount, UserContact } from "./schema";
import { getAppDataDir, joinPath } from "@/lib/utils/path";

// Load environment variables
config({ path: ".env" });

// ============================================================
// Force set Tauri mode environment variables
// ============================================================
process.env.TAURI_MODE = "1";
process.env.IS_TAURI = "true";

// Get database path parameters (from command line or environment variables)
const DB_PATH = process.argv.includes("--db")
  ? process.argv[process.argv.indexOf("--db") + 1]
  : process.env.TAURI_DB_PATH || joinPath(getAppDataDir(), "data", "data.db");

console.log(`Using SQLite database at: ${DB_PATH}`);

// ============================================================
// Type definitions
// ============================================================
interface UserData {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface DumpData {
  cloudUser: UserData;
  bots: Bot[];
  insights: Insight[];
  integrationAccounts: IntegrationAccount[];
  contacts: UserContact[];
}

interface MigrationResult {
  bots: { migrated: number; failed: number };
  insights: { migrated: number; failed: number };
  integrations: { migrated: number; failed: number };
  contacts: { migrated: number; failed: number };
  errors: string[];
}

// ============================================================
// SQLite database initialization
// ============================================================
let sqliteDb: ReturnType<typeof drizzle> | null = null;

async function initSqliteDb(dbPath: string) {
  if (sqliteDb) {
    return sqliteDb;
  }

  console.log(`Initializing SQLite database at: ${dbPath}`);

  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 30000");
  sqlite.pragma("synchronous = NORMAL");

  // Check if tables exist, initialize schema if not
  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as Array<{ name: string }>;

  // Check if required tables exist
  const requiredTables = [
    "User",
    "Bot",
    "platform_accounts",
    "user_meta_contacts",
    "Insight",
  ];
  const missingTables = requiredTables.filter(
    (t) => !tables.some((tbl) => tbl.name === t),
  );

  if (missingTables.length > 0) {
    console.log(
      `  Missing tables: ${missingTables.join(", ")}, initializing schema...`,
    );
    await initSchema(sqlite);
  } else {
    console.log(`  Database has ${tables.length} tables`);
  }

  sqliteDb = drizzle(sqlite, { schema: sqliteSchema });
  return sqliteDb;
}

// Create base table structure from Drizzle schema
async function initSchema(sqlite: Database.Database) {
  // Create __drizzle_migrations table (if using drizzle migrate)
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        created_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `);
  } catch (e) {
    // ignore
  }

  // Mark as migrated to avoid duplicate runs
  try {
    sqlite
      .prepare(
        "INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      )
      .run("0000_initial", Date.now());
  } catch (e) {
    // ignore
  }

  // Create User table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "email" TEXT NOT NULL,
      "password" TEXT,
      "name" TEXT,
      "avatar_url" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "first_login_at" INTEGER,
      "last_login_at" INTEGER,
      "finish_on_boarding" INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Create Bot table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "Bot" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "User"("id"),
      "platform_account_id" TEXT,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "adapter" TEXT NOT NULL,
      "adapter_config" TEXT NOT NULL,
      "enable" INTEGER NOT NULL DEFAULT 0,
      "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // Create platform_accounts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "platform_accounts" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "User"("id"),
      "platform" TEXT NOT NULL,
      "external_id" TEXT NOT NULL,
      "display_name" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "metadata" TEXT,
      "credentials_encrypted" TEXT NOT NULL,
      "encryption_key_id" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // Create index
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS "platform_accounts_user_idx" ON "platform_accounts"("userId")`,
  );

  // Create user_meta_contacts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user_meta_contacts" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "User"("id"),
      "contact_id" TEXT NOT NULL,
      "contact_name" TEXT NOT NULL,
      "contact_type" TEXT,
      "bot_id" TEXT,
      "contact_meta" TEXT
    )
  `);

  // Create index
  sqlite.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_contact" ON "user_meta_contacts"("user_id", "bot_id", "contact_name")`,
  );

  // Create Insight table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "Insight" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "botId" TEXT NOT NULL,
      "dedupe_key" TEXT,
      "taskLabel" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "importance" TEXT NOT NULL,
      "urgency" TEXT NOT NULL,
      "platform" TEXT,
      "account" TEXT,
      "groups" TEXT NOT NULL DEFAULT '[]',
      "people" TEXT NOT NULL DEFAULT '[]',
      "time" INTEGER NOT NULL,
      "details" TEXT,
      "timeline" TEXT,
      "insights" TEXT,
      "trend_direction" TEXT,
      "trend_confidence" TEXT,
      "sentiment" TEXT,
      "sentiment_confidence" TEXT,
      "intent" TEXT,
      "trend" TEXT,
      "issue_status" TEXT,
      "community_trend" TEXT,
      "duplicate_flag" INTEGER,
      "impact_level" TEXT,
      "resolution_hint" TEXT,
      "top_keywords" TEXT DEFAULT '[]',
      "top_entities" TEXT DEFAULT '[]',
      "top_voices" TEXT,
      "sources" TEXT,
      "source_concentration" TEXT,
      "buyer_signals" TEXT DEFAULT '[]',
      "stakeholders" TEXT,
      "contract_status" TEXT,
      "signal_type" TEXT,
      "confidence" TEXT,
      "scope" TEXT,
      "next_actions" TEXT,
      "follow_ups" TEXT,
      "action_required" INTEGER,
      "action_required_details" TEXT,
      "is_unreplied" INTEGER DEFAULT 0,
      "my_tasks" TEXT,
      "waiting_for_me" TEXT,
      "waiting_for_others" TEXT,
      "clarify_needed" INTEGER,
      "categories" TEXT DEFAULT '[]',
      "learning" TEXT,
      "priority" TEXT,
      "experiment_ideas" TEXT,
      "executive_summary" TEXT,
      "risk_flags" TEXT,
      "client" TEXT,
      "project_name" TEXT,
      "next_milestone" TEXT,
      "due_date" TEXT,
      "payment_info" TEXT,
      "entity" TEXT,
      "why" TEXT,
      "history_summary" TEXT,
      "strategic" TEXT,
      "role_attribution" TEXT,
      "alerts" TEXT,
      "is_archived" INTEGER NOT NULL DEFAULT 0,
      "is_favorited" INTEGER NOT NULL DEFAULT 0,
      "archived_at" INTEGER,
      "favorited_at" INTEGER,
      "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "timeline_version" INTEGER NOT NULL DEFAULT 1,
      "last_timeline_update" INTEGER
    )
  `);

  console.log("  Schema initialized successfully");
}

function getSqliteDb() {
  if (!sqliteDb) {
    throw new Error("SQLite database not initialized");
  }
  return sqliteDb;
}

// ============================================================
// Cloud PostgreSQL database initialization
// ============================================================
function initCloudDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzlePg(client, { schema: pgSchema });
}

// ============================================================
// Helper functions: type conversion
// ============================================================
function timestampToSqlite(
  value: Date | string | number | null | undefined,
): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date;
}

function jsonToSqlite(value: any): string {
  return JSON.stringify(value ?? null);
}

function booleanToSqlite(value: boolean | null | undefined): number {
  return value ? 1 : 0;
}

function arrayToSqlite(value: any[] | null | undefined): string {
  return JSON.stringify(value ?? []);
}

// ============================================================
// Dump mode: Fetch data from cloud and export to JSON files
// ============================================================
export async function dumpUserData(options: {
  cloudDbUrl: string;
  cloudUserEmail: string;
  outputFile?: string;
}): Promise<DumpData> {
  const cloudDb = initCloudDb(options.cloudDbUrl);

  try {
    console.log("========================================");
    console.log("Cloud Data Dump");
    console.log("========================================");
    console.log(`Cloud DB: ${options.cloudDbUrl}`);
    console.log(`Cloud User: ${options.cloudUserEmail}`);
    console.log("========================================\n");

    // Fetch cloud user
    console.log(`Fetching cloud user: ${options.cloudUserEmail}`);
    const [cloudUser] = await cloudDb
      .select()
      .from(pgSchema.user)
      .where(eq(pgSchema.user.email, options.cloudUserEmail))
      .limit(1);

    if (!cloudUser) {
      throw new Error(`Cloud user not found: ${options.cloudUserEmail}`);
    }

    console.log(`Cloud user found: ${cloudUser.name || cloudUser.email}\n`);

    // Fetch bots
    console.log("Fetching bots...");
    const bots = await cloudDb
      .select()
      .from(pgSchema.bot)
      .where(eq(pgSchema.bot.userId, cloudUser.id));
    console.log(`Found ${bots.length} bots\n`);

    // Get bot IDs for querying insights
    const botIds = bots.map((b) => b.id);

    // Fetch insights
    console.log("Fetching insights...");
    let insights: Insight[] = [];
    if (botIds.length > 0) {
      insights = await cloudDb
        .select()
        .from(pgSchema.insight)
        .where(isNotNull(pgSchema.insight.botId));
      // Only export insights belonging to this user
      insights = insights.filter((insight) => botIds.includes(insight.botId));
    }
    console.log(`Found ${insights.length} insights\n`);

    // Fetch integration accounts
    console.log("Fetching integration accounts...");
    const integrationAccounts = await cloudDb
      .select()
      .from(pgSchema.integrationAccounts)
      .where(eq(pgSchema.integrationAccounts.userId, cloudUser.id));
    console.log(`Found ${integrationAccounts.length} integration accounts\n`);

    // Fetch contacts
    console.log("Fetching contacts...");
    const contacts = await cloudDb
      .select()
      .from(pgSchema.userContacts)
      .where(eq(pgSchema.userContacts.userId, cloudUser.id));
    console.log(`Found ${contacts.length} contacts\n`);

    const dumpData: DumpData = {
      cloudUser: {
        id: cloudUser.id,
        email: cloudUser.email,
        name: cloudUser.name,
        avatarUrl: cloudUser.avatarUrl,
      },
      bots,
      insights,
      integrationAccounts,
      contacts,
    };

    // If outputFile is not specified, return data without saving to file
    if (!options.outputFile) {
      console.log("Dump completed (data not saved to file)");
      return dumpData;
    }

    // Save to specified file
    await fsp.mkdir(path.dirname(options.outputFile), { recursive: true });
    await fsp.writeFile(options.outputFile, JSON.stringify(dumpData, null, 2));

    console.log("========================================");
    console.log("Dump Summary");
    console.log("========================================");
    console.log(`Output file: ${options.outputFile}`);
    console.log(`Bots: ${bots.length}`);
    console.log(`Insights: ${insights.length}`);
    console.log(`Integration Accounts: ${integrationAccounts.length}`);
    console.log(`Contacts: ${contacts.length}`);
    console.log("========================================\n");

    return dumpData;
  } finally {
    (cloudDb as any).$client.end();
  }
}

// ============================================================
// Load mode: Import data from JSON files to local SQLite
// ============================================================
export async function loadUserDataToLocal(options: {
  inputFile: string;
  targetUserEmail?: string;
}): Promise<MigrationResult> {
  const result: MigrationResult = {
    bots: { migrated: 0, failed: 0 },
    insights: { migrated: 0, failed: 0 },
    integrations: { migrated: 0, failed: 0 },
    contacts: { migrated: 0, failed: 0 },
    errors: [],
  };

  try {
    console.log("========================================");
    console.log("Local Data Load");
    console.log("========================================");
    console.log(`Input file: ${options.inputFile}`);
    console.log(
      `Target user: ${options.targetUserEmail || "Same as cloud user"}`,
    );
    console.log(`Database path: ${DB_PATH}`);
    console.log("========================================\n");

    // Initialize SQLite database
    const db = await initSqliteDb(DB_PATH);

    // Read JSON file
    const content = await fsp.readFile(options.inputFile, "utf-8");
    const dumpData: DumpData = JSON.parse(content);

    const cloudUser = dumpData.cloudUser;
    const targetEmail = options.targetUserEmail || cloudUser.email;

    console.log(`Source cloud user: ${cloudUser.name || cloudUser.email}`);
    console.log(`Target local user: ${targetEmail}\n`);

    // Find or create local user
    let targetUser: any = null;

    const existingUsers = db
      .select()
      .from(sqliteSchema.user)
      .where(eq(sqliteSchema.user.email, targetEmail))
      .all();

    if (existingUsers.length > 0) {
      targetUser = existingUsers[0];
      console.log(`Found existing local user: ${targetUser.id}`);
    } else {
      // Create new user
      const newUserId = crypto.randomUUID();
      const now = new Date();
      db.insert(sqliteSchema.user)
        .values({
          id: newUserId,
          email: targetEmail,
          name: cloudUser.name,
          avatarUrl: cloudUser.avatarUrl,
          createdAt: now,
          updatedAt: now,
        } as any)
        .run();
      targetUser = { id: newUserId };
      console.log(`Created new local user: ${newUserId}`);
    }

    console.log(`Local target user ID: ${targetUser.id}\n`);

    // Clean up existing local data
    console.log("Cleaning up existing local data...");

    // Clean up contacts
    db.delete(sqliteSchema.userContacts)
      .where(eq(sqliteSchema.userContacts.userId, targetUser.id))
      .run();
    console.log("  Cleaned up existing contacts");

    // Clean up insights (via bot)
    const existingBots = db
      .select()
      .from(sqliteSchema.bot)
      .where(eq(sqliteSchema.bot.userId, targetUser.id))
      .all();

    if (existingBots.length > 0) {
      const botIds = existingBots.map((b: any) => b.id);
      for (const botId of botIds) {
        db.delete(sqliteSchema.insight)
          .where(eq(sqliteSchema.insight.botId, botId))
          .run();
      }
      console.log("  Cleaned up existing insights");
    }

    // Clean up bots
    db.delete(sqliteSchema.bot)
      .where(eq(sqliteSchema.bot.userId, targetUser.id))
      .run();
    console.log("  Cleaned up existing bots");

    // Clean up integration accounts (keep existing ones)
    const existingAccounts = db
      .select()
      .from(sqliteSchema.integrationAccounts)
      .where(eq(sqliteSchema.integrationAccounts.userId, targetUser.id))
      .all();

    console.log();

    // Start import
    console.log("Starting import...\n");

    // 1. Import Integration Accounts
    console.log("--- Step 1: Importing Integration Accounts ---");
    const accountIdMap = new Map<string, string>();
    for (const account of dumpData.integrationAccounts) {
      try {
        // Check if already exists
        const existing = existingAccounts.find(
          (a: any) =>
            a.platform === account.platform &&
            a.externalId === account.externalId,
        );

        if (existing) {
          accountIdMap.set(account.id, existing.id);
          console.log(
            `  Skipping existing account: ${account.displayName} (${account.platform})`,
          );
          continue;
        }

        const newAccountId = crypto.randomUUID();
        const now = new Date();

        // Use any to bypass TypeScript check, manually specify id
        db.insert(sqliteSchema.integrationAccounts)
          .values({
            id: newAccountId,
            userId: targetUser.id,
            platform: account.platform,
            externalId: account.externalId,
            displayName: account.displayName,
            status: "active",
            metadata: account.metadata ? jsonToSqlite(account.metadata) : null,
            credentialsEncrypted: account.credentialsEncrypted || "",
            encryptionKeyId: account.encryptionKeyId,
            createdAt: now,
            updatedAt: now,
          } as any)
          .run();

        accountIdMap.set(account.id, newAccountId);
        result.integrations.migrated++;
        console.log(
          `  Imported account: ${account.displayName} (${account.platform})`,
        );
      } catch (error: any) {
        result.integrations.failed++;
        console.error(
          `  Failed to import account ${account.id}:`,
          error.message,
        );
        result.errors.push(`Account ${account.id}: ${error.message}`);
      }
    }
    console.log(
      `Integration accounts: ${result.integrations.migrated} imported, ${result.integrations.failed} failed\n`,
    );

    // 2. Import Bots
    console.log("--- Step 2: Importing Bots ---");
    const botIdMap = new Map<string, string>();
    for (const bot of dumpData.bots) {
      try {
        const platformAccountId = bot.platformAccountId
          ? accountIdMap.get(bot.platformAccountId)
          : null;
        const newBotId = crypto.randomUUID();
        const now = new Date();

        db.insert(sqliteSchema.bot)
          .values({
            id: newBotId,
            userId: targetUser.id,
            name: bot.name,
            description: bot.description,
            adapter: bot.adapter,
            adapterConfig: jsonToSqlite(bot.adapterConfig),
            enable: booleanToSqlite(bot.enable),
            platformAccountId,
            createdAt: now,
            updatedAt: now,
          } as any)
          .run();

        botIdMap.set(bot.id, newBotId);
        result.bots.migrated++;
        console.log(`  Imported bot: ${bot.name}`);
      } catch (error: any) {
        result.bots.failed++;
        console.error(`  Failed to import bot ${bot.id}:`, error.message);
        result.errors.push(`Bot ${bot.id}: ${error.message}`);
      }
    }
    console.log(
      `Bots: ${result.bots.migrated} imported, ${result.bots.failed} failed\n`,
    );

    // 3. Import Insights
    console.log("--- Step 3: Importing Insights ---");
    const insightsByBot = new Map<string, Insight[]>();
    for (const insight of dumpData.insights) {
      const newBotId = botIdMap.get(insight.botId);
      if (!newBotId) {
        console.warn(
          `  Skipping insight ${insight.id}: bot ID mapping not found`,
        );
        continue;
      }
      if (!insightsByBot.has(newBotId)) {
        insightsByBot.set(newBotId, []);
      }
      insightsByBot.get(newBotId)?.push(insight);
    }

    for (const [newBotId, botInsights] of insightsByBot) {
      for (const insight of botInsights) {
        try {
          const newInsightId = crypto.randomUUID();
          const time = timestampToSqlite(insight.time);

          db.insert(sqliteSchema.insight)
            .values({
              id: newInsightId,
              botId: newBotId,
              dedupeKey: insight.dedupeKey,
              taskLabel: insight.taskLabel,
              title: insight.title,
              description: insight.description,
              importance: insight.importance,
              urgency: insight.urgency,
              platform: insight.platform,
              account: insight.account,
              groups: arrayToSqlite(insight.groups),
              people: arrayToSqlite(insight.people),
              time,
              details: insight.details ? jsonToSqlite(insight.details) : null,
              timeline: insight.timeline
                ? jsonToSqlite(insight.timeline)
                : null,
              insights: insight.insights
                ? jsonToSqlite(insight.insights)
                : null,
              trendDirection: insight.trendDirection,
              trendConfidence: insight.trendConfidence?.toString() ?? null,
              sentiment: insight.sentiment,
              sentimentConfidence:
                insight.sentimentConfidence?.toString() ?? null,
              intent: insight.intent,
              trend: insight.trend,
              issueStatus: insight.issueStatus,
              communityTrend: insight.communityTrend,
              duplicateFlag: booleanToSqlite(insight.duplicateFlag),
              impactLevel: insight.impactLevel,
              resolutionHint: insight.resolutionHint,
              topKeywords: arrayToSqlite(insight.topKeywords),
              topEntities: arrayToSqlite(insight.topEntities),
              topVoices: insight.topVoices
                ? jsonToSqlite(insight.topVoices)
                : null,
              sources: insight.sources ? jsonToSqlite(insight.sources) : null,
              sourceConcentration: insight.sourceConcentration,
              buyerSignals: arrayToSqlite(insight.buyerSignals),
              stakeholders: insight.stakeholders
                ? jsonToSqlite(insight.stakeholders)
                : null,
              contractStatus: insight.contractStatus,
              signalType: insight.signalType,
              confidence: insight.confidence?.toString() ?? null,
              scope: insight.scope,
              nextActions: insight.nextActions
                ? jsonToSqlite(insight.nextActions)
                : null,
              followUps: insight.followUps
                ? jsonToSqlite(insight.followUps)
                : null,
              actionRequired: booleanToSqlite(insight.actionRequired),
              actionRequiredDetails: insight.actionRequiredDetails
                ? jsonToSqlite(insight.actionRequiredDetails)
                : null,
              isUnreplied: booleanToSqlite(insight.isUnreplied),
              myTasks: insight.myTasks ? jsonToSqlite(insight.myTasks) : null,
              waitingForMe: insight.waitingForMe
                ? jsonToSqlite(insight.waitingForMe)
                : null,
              waitingForOthers: insight.waitingForOthers
                ? jsonToSqlite(insight.waitingForOthers)
                : null,
              clarifyNeeded: booleanToSqlite(insight.clarifyNeeded),
              categories: arrayToSqlite(insight.categories),
              learning: insight.learning,
              experimentIdeas: insight.experimentIdeas
                ? jsonToSqlite(insight.experimentIdeas)
                : null,
              executiveSummary: insight.executiveSummary,
              riskFlags: insight.riskFlags
                ? jsonToSqlite(insight.riskFlags)
                : null,
              strategic: insight.strategic
                ? jsonToSqlite(insight.strategic)
                : null,
              client: insight.client,
              projectName: insight.projectName,
              nextMilestone: insight.nextMilestone,
              dueDate: insight.dueDate,
              paymentInfo: insight.paymentInfo,
              entity: insight.entity,
              why: insight.why,
              historySummary: insight.historySummary
                ? jsonToSqlite(insight.historySummary)
                : null,
              roleAttribution: insight.roleAttribution
                ? jsonToSqlite(insight.roleAttribution)
                : null,
              alerts: insight.alerts ? jsonToSqlite(insight.alerts) : null,
              isFavorited: booleanToSqlite(insight.isFavorited),
              favoritedAt: timestampToSqlite(insight.favoritedAt),
              isArchived: booleanToSqlite(insight.isArchived),
              archivedAt: timestampToSqlite(insight.archivedAt),
            } as any)
            .run();

          result.insights.migrated++;
        } catch (error: any) {
          result.insights.failed++;
          console.error(
            `  Failed to import insight ${insight.id}:`,
            error.message,
          );
          result.errors.push(`Insight ${insight.id}: ${error.message}`);
        }
      }
    }
    console.log(
      `Insights: ${result.insights.migrated} imported, ${result.insights.failed} failed\n`,
    );

    // 4. Import Contacts
    console.log("--- Step 4: Importing Contacts ---");
    const contactsMap = new Map<string, any>();
    for (const contact of dumpData.contacts) {
      const newBotId = contact.botId ? botIdMap.get(contact.botId) : null;
      const key = `${targetUser.id}-${contact.contactName}-${newBotId || ""}`;

      if (contactsMap.has(key)) {
        continue;
      }

      contactsMap.set(key, {
        id: crypto.randomUUID(),
        contactId: contact.contactId,
        contactName: contact.contactName,
        type: contact.type,
        contactMeta: contact.contactMeta
          ? jsonToSqlite(contact.contactMeta)
          : null,
        userId: targetUser.id,
        botId: newBotId,
      });
    }

    const dedupedContacts = Array.from(contactsMap.values());
    if (dedupedContacts.length > 0) {
      for (const contact of dedupedContacts) {
        try {
          db.insert(sqliteSchema.userContacts).values(contact).run();
          result.contacts.migrated++;
        } catch (error: any) {
          result.contacts.failed++;
          console.error(`  Failed to import contact:`, error.message);
          result.errors.push(
            `Contact ${contact.contactName}: ${error.message}`,
          );
        }
      }
      console.log(`  Imported ${result.contacts.migrated} contacts`);
    }
    console.log(
      `Contacts: ${result.contacts.migrated} imported, ${result.contacts.failed} failed\n`,
    );

    console.log("========================================");
    console.log("Import Summary");
    console.log("========================================");
    console.log(
      `Bots: ${result.bots.migrated} imported, ${result.bots.failed} failed`,
    );
    console.log(
      `Insights: ${result.insights.migrated} imported, ${result.insights.failed} failed`,
    );
    console.log(
      `Integrations: ${result.integrations.migrated} imported, ${result.integrations.failed} failed`,
    );
    console.log(
      `Contacts: ${result.contacts.migrated} imported, ${result.contacts.failed} failed`,
    );
    if (result.errors.length > 0) {
      console.log(`\nErrors: ${result.errors.length}`);
      result.errors.forEach((err) => console.log(`  - ${err}`));
    }
    console.log("========================================\n");

    return result;
  } catch (error) {
    console.error("Import failed:", error);
    throw error;
  }
}

// ============================================================
// One-click migration: Migrate from cloud directly to local
// ============================================================
export async function migrateCloudToLocalOneShot(options: {
  cloudDbUrl: string;
  sourceUserEmail: string;
  targetUserEmail: string;
}): Promise<void> {
  console.log("========================================");
  console.log("One-Shot Cloud to Local Migration");
  console.log("========================================");
  console.log(`Source User: ${options.sourceUserEmail}`);
  console.log(`Target User: ${options.targetUserEmail}`);
  console.log(`Database: ${DB_PATH}`);
  console.log("========================================\n");

  // Step 1: Dump (don't save file, directly fetch data)
  const dumpData = await dumpUserData({
    cloudDbUrl: options.cloudDbUrl,
    cloudUserEmail: options.sourceUserEmail,
    outputFile: "", // Don't save file
  });

  // Create temporary file for load (in system temp directory)
  const tempDir = process.env.TMPDIR || process.env.TMP || "/tmp";
  const tempFile = path.join(tempDir, `alloomi-migrate-${Date.now()}.json`);
  await fsp.writeFile(tempFile, JSON.stringify(dumpData, null, 2));

  console.log("\n--- Switching to Load Mode ---\n");

  // Step 2: Load
  await loadUserDataToLocal({
    inputFile: tempFile,
    targetUserEmail: options.targetUserEmail,
  });

  // Clean up temporary file
  await fsp.unlink(tempFile);
  console.log("One-shot migration completed!");
}

// ============================================================
// CLI execution
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: tsx migrate-cloud-to-local.ts <command> [args...]\n");
    console.log("Options:");
    console.log(
      "  --db <path>    Specify SQLite database path (default: ~/.alloomi/data/data.db)\n",
    );
    console.log("Commands:");
    console.log("  migrate <source-email> <target-email> [cloud-db-url]");
    console.log("    One-shot: migrate from cloud directly to local");
    console.log();
    console.log("  dump <cloud-db-url> <user-email> [output-file]");
    console.log("    Export user data from cloud database to JSON file");
    console.log();
    console.log("  load <input-file> [target-user-email]");
    console.log("    Import user data from JSON file to local database");
    console.log();
    console.log("Examples:");
    console.log(
      "  tsx migrate-cloud-to-local.ts migrate user@example.com local@example.com",
    );
    console.log(
      "  tsx migrate-cloud-to-local.ts --db /path/to/db.db migrate user@example.com local@example.com",
    );
    console.log(
      "  tsx migrate-cloud-to-local.ts dump 'postgres://user:pass@host:5432/db' user@example.com",
    );
    console.log(
      "  tsx migrate-cloud-to-local.ts load './user-dumps/dump.json' local@example.com",
    );
    process.exit(1);
  }

  const command = args[0];

  if (command === "migrate") {
    if (args.length < 3) {
      console.log(
        "Usage: tsx migrate-cloud-to-local.ts migrate <source-email> <target-email> [cloud-db-url]",
      );
      console.log(
        "  cloud-db-url: optional, defaults to POSTGRES_URL from .env",
      );
      process.exit(1);
    }

    const [_, sourceEmail, targetEmail, cloudDbUrl] = args;

    const dbUrl =
      cloudDbUrl || process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error(
        "Error: POSTGRES_URL or DATABASE_URL environment variable not found",
      );
      process.exit(1);
    }

    migrateCloudToLocalOneShot({
      cloudDbUrl: dbUrl,
      sourceUserEmail: sourceEmail,
      targetUserEmail: targetEmail,
    })
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.error("Migration failed:", error);
        process.exit(1);
      });
  } else if (command === "dump") {
    if (args.length < 3) {
      console.log(
        "Usage: tsx migrate-cloud-to-local.ts dump <cloud-db-url> <user-email> [output-file]",
      );
      process.exit(1);
    }

    const [_, cloudDbUrl, userEmail, outputFile] = args;

    dumpUserData({ cloudDbUrl, cloudUserEmail: userEmail, outputFile })
      .then(() => {
        console.log("Dump completed successfully!");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Dump failed:", error);
        process.exit(1);
      });
  } else if (command === "load") {
    if (args.length < 2) {
      console.log(
        "Usage: tsx migrate-cloud-to-local.ts load <input-file> [target-user-email]",
      );
      process.exit(1);
    }

    const [_, inputFile, targetUserEmail] = args;

    loadUserDataToLocal({ inputFile, targetUserEmail })
      .then(() => {
        console.log("Load completed successfully!");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Load failed:", error);
        process.exit(1);
      });
  } else {
    console.log(`Unknown command: ${command}`);
    console.log("Run without arguments for usage information");
    process.exit(1);
  }
}
