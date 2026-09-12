import { MongoClient } from "mongodb";
import type { NewsArticle } from "./marketlens.js";
import { logger } from "./logger.js";

export type NewsSnapshotValue = {
  articles: NewsArticle[];
  updatedAt: string;
  query: string;
};

type NewsSnapshotDocument = NewsSnapshotValue & {
  dateKey: string;
  savedAt: Date;
};

const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/marketlens";

let clientPromise: Promise<MongoClient> | null = null;
let indexesPromise: Promise<void> | null = null;

export async function getCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI is not configured in environment");
    }
  }
  const targetUri = uri || DEFAULT_MONGODB_URI;

  if (!clientPromise) {
    const client = new MongoClient(targetUri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      appName: "MarketLens",
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }

  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB_NAME || "marketlens";
  const collection = client
    .db(dbName)
    .collection<NewsSnapshotDocument>("news_snapshots");

  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex({ dateKey: 1 }, { unique: true }),
      collection.createIndex(
        { savedAt: 1 },
        { expireAfterSeconds: 45 * 24 * 60 * 60 },
      ),
    ])
      .then(() => undefined)
      .catch((err) => {
        logger.warn({ err: err?.message || err }, "Failed to create MongoDB indexes on news_snapshots");
      });
  }
  await indexesPromise;

  return collection;
}

export async function checkDbConnection(): Promise<{ ok: boolean; message: string; uri: string }> {
  const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  try {
    const collection = await getCollection();
    const count = await collection.countDocuments();
    return { ok: true, message: `MongoDB connected (${count} snapshots stored)`, uri: maskUri(uri) };
  } catch (err: any) {
    clientPromise = null;
    return { ok: false, message: `MongoDB connection error: ${err?.message || err}`, uri: maskUri(uri) };
  }
}

function maskUri(uri: string): string {
  return uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}

export async function readNewsSnapshot(dateKey: string): Promise<NewsSnapshotValue | null> {
  try {
    const collection = await getCollection();
    const document = await collection.findOne({ dateKey });
    if (!document) return null;

    return {
      articles: document.articles,
      updatedAt: document.updatedAt,
      query: document.query,
    } satisfies NewsSnapshotValue;
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, "Could not read news snapshot from MongoDB");
    clientPromise = null;
    return null;
  }
}

export async function writeNewsSnapshot(
  dateKey: string,
  value: NewsSnapshotValue,
): Promise<void> {
  try {
    const collection = await getCollection();
    await collection.replaceOne(
      { dateKey },
      {
        ...value,
        dateKey,
        savedAt: new Date(),
      },
      { upsert: true },
    );
    logger.info({ dateKey, count: value.articles.length }, "Saved news snapshot to MongoDB");
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, "Could not write news snapshot to MongoDB");
    clientPromise = null;
  }
}