import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDb } from "@/lib/mongodb";
import { mapFixedHeader } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const batch = (formData.get("batch") as string) || String(new Date().getFullYear());
    const board = (formData.get("board") as string) || "BIHAR";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: "",
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);
    const subjectHeaders: string[] = [];
    const headerMap: Record<string, { type: "fixed" | "subject"; field: string }> = {};

    for (const h of headers) {
      const fixed = mapFixedHeader(h);
      if (fixed) {
        headerMap[h] = { type: "fixed", field: fixed };
      } else if (h.trim() !== "" && !h.startsWith("__EMPTY")) {
        const subjectKey = h.trim().toUpperCase().replace(/\s+/g, "_");
        headerMap[h] = { type: "subject", field: subjectKey };
        subjectHeaders.push(subjectKey);
      }
    }

    const studentDocs = rows.map((row) => {
      const doc: Record<string, unknown> = {
        subjects: {} as Record<string, number | null>,
        board: (board as string).toUpperCase(),
        batch,
        importedAt: new Date(),
      };

      for (const [rawHeader, meta] of Object.entries(headerMap)) {
        const val = row[rawHeader];
        if (meta.type === "fixed") {
          if (meta.field === "total" || meta.field === "percentage") {
            doc[meta.field] = val !== "" ? Number(val) : null;
          } else {
            doc[meta.field] = String(val ?? "").trim();
          }
        } else {
          (doc.subjects as Record<string, number | null>)[meta.field] =
            val !== "" ? Number(val) : null;
        }
      }

      return doc;
    });

    const validDocs = studentDocs.filter(
      (d) => d.rollNumber && String(d.rollNumber).trim() !== ""
    );

    const db = await getDb();
    const studentsCol = db.collection("students");
    const subjectsRegistryCol = db.collection("subjects_registry");

    await studentsCol.createIndex({ rollCode: 1, rollNumber: 1, batch: 1 }, { unique: true });
    await studentsCol.createIndex({ rollNumber: 1 });
    await studentsCol.createIndex({ name: 1 });
    await studentsCol.createIndex({ district: 1 });
    await studentsCol.createIndex({ division: 1 });
    await studentsCol.createIndex({ status: 1 });
    await studentsCol.createIndex({ percentage: -1 });
    await studentsCol.createIndex({ batch: 1 });
    await studentsCol.createIndex({ board: 1 });

    const bulkOps = validDocs.map((doc) => ({
      updateOne: {
        filter: { rollCode: doc.rollCode || "", rollNumber: doc.rollNumber, batch: doc.batch },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const result = await studentsCol.bulkWrite(bulkOps, { ordered: false });

    const uniqueSubjects = [...new Set(subjectHeaders)];
    for (const subjectKey of uniqueSubjects) {
      await subjectsRegistryCol.updateOne(
        { name: subjectKey },
        {
          $set: {
            name: subjectKey,
            displayName: subjectKey.replace(/_/g, " "),
          },
          $setOnInsert: { firstSeenAt: new Date() },
          $addToSet: { batches: batch },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
      total: validDocs.length,
      skipped: studentDocs.length - validDocs.length,
      subjectsDiscovered: uniqueSubjects,
    });
  } catch (err: unknown) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
