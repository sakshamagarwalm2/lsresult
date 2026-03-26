import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const db = await getDb();
  const col = db.collection("students");

  const [batches, boards, districts, divisions, statuses] = await Promise.all([
    col.distinct("batch"),
    col.distinct("board"),
    col.distinct("district"),
    col.distinct("division"),
    col.distinct("status"),
  ]);

  return NextResponse.json({
    batches: batches.filter(Boolean).sort(),
    boards: boards.filter(Boolean).sort(),
    districts: districts.filter(Boolean).sort(),
    divisions: divisions.filter(Boolean).sort(),
    statuses: statuses.filter(Boolean).sort(),
  });
}
