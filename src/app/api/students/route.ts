import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const batch = searchParams.get("batch") || undefined;
  const board = searchParams.get("board") || undefined;
  const district = searchParams.get("district") || undefined;
  const school = searchParams.get("school") || undefined;
  const division = searchParams.get("division") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const minPercent = searchParams.get("minPercent");
  const maxPercent = searchParams.get("maxPercent");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(200, parseInt(searchParams.get("limit") || "50"));

  const filter: Record<string, unknown> = {};

  if (batch) filter.batch = batch;
  if (board) filter.board = { $regex: board, $options: "i" };
  if (district) filter.district = { $regex: district, $options: "i" };
  if (school) filter.school = { $regex: school, $options: "i" };
  if (division) filter.division = { $regex: division, $options: "i" };
  if (status) filter.status = { $regex: status, $options: "i" };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { rollNumber: { $regex: search, $options: "i" } },
    ];
  }

  if (minPercent || maxPercent) {
    const pct: Record<string, number> = {};
    if (minPercent) pct.$gte = Number(minPercent);
    if (maxPercent) pct.$lte = Number(maxPercent);
    filter.percentage = pct;
  }

  const db = await getDb();
  const col = db.collection("students");

  const [students, total] = await Promise.all([
    col
      .find(filter)
      .sort({ percentage: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ]);

  const data = students.map((s) => ({
    ...s,
    _id: s._id.toString(),
  }));

  return NextResponse.json({ data, total, page, limit });
}
