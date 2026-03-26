import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// SubjectData interface removed as we now use Record<string, number | null>

interface SavePayload {
  rollCode: string;
  rollNumber: string;
  name: string;
  mobile?: string;
  fatherName?: string;
  schoolName?: string;
  faculty?: string;
  registrationNumber?: string;
  subjects: Record<string, number | null>;
  subjectCategories?: Record<string, string>;
  total: number;
  percentage: number;
  division: string;
  board: string;
  batch: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SavePayload = await req.json();
    console.log("save-results payload:", JSON.stringify(body));

    if (!body.rollNumber || !body.name) {
      return NextResponse.json(
        { error: "rollNumber and name are required", received: { rollNumber: body.rollNumber, name: body.name } },
        { status: 400 }
      );
    }

    const db = await getDb();
    const col = db.collection("students");

    const subjectsMap = body.subjects || {};

    // Also register subjects
    const subjectsRegistryCol = db.collection("subjects_registry");
    for (const key of Object.keys(subjectsMap)) {
      await subjectsRegistryCol.updateOne(
        { name: key },
        {
          $set: { name: key, displayName: key.replace(/_/g, " ") },
          $setOnInsert: { firstSeenAt: new Date() },
          $addToSet: { batches: body.batch || String(new Date().getFullYear()) },
        },
        { upsert: true }
      );
    }

    await col.createIndex({ rollCode: 1, rollNumber: 1, batch: 1 }, { unique: true });
    await col.createIndex({ board: 1 });
    await col.createIndex({ batch: 1 });

    const doc = {
      rollCode: body.rollCode,
      rollNumber: body.rollNumber,
      name: body.name,
      mobileNumber: body.mobile || "",
      fatherName: body.fatherName || "",
      school: body.schoolName || "",
      faculty: body.faculty || "",
      registrationNumber: body.registrationNumber || "",
      subjects: subjectsMap,
      subjectCategories: body.subjectCategories || {},
      total: body.total ? Number(body.total) : null,
      percentage: body.percentage ?? null,
      division: body.division || "",
      status: body.percentage != null && body.percentage >= 33 ? "PASS" : "FAIL",
      board: body.board || "BIHAR",
      batch: body.batch || String(new Date().getFullYear()),
      savedAt: new Date(),
    };

    // Normalize name for deduplication (uppercase, trimmed)
    const normalizedName = doc.name.toUpperCase().trim();
    doc.name = normalizedName;

    await col.updateOne(
      { rollCode: doc.rollCode, rollNumber: doc.rollNumber, batch: doc.batch },
      { $set: doc },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
