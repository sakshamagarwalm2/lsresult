import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDb();
  const subjects = await db
    .collection("subjects_registry")
    .find({})
    .sort({ name: 1 })
    .toArray();

  return NextResponse.json(
    subjects.map((s) => ({
      name: s.name,
      displayName: s.displayName,
      batches: s.batches ?? [],
    }))
  );
}
