import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB || "lsresult";

const clientOptions = {
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!uri) {
  throw new Error("Please add MONGODB_URI to .env.local");
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const c = await clientPromise;
  return c.db(dbName);
}

export default clientPromise;
