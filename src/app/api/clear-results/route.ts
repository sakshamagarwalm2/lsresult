import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batch = searchParams.get("batch") || undefined;
    const board = searchParams.get("board") || undefined;

    const db = await getDb();
    const col = db.collection("students");

    const filter: Record<string, unknown> = {};
    if (batch) filter.batch = batch;
    if (board) filter.board = board;

    const result = await col.deleteMany(filter);

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (err: unknown) {
    console.error("Clear error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed" },
      { status: 500 }
    );
  }
}
