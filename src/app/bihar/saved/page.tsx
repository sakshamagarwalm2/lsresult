"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

interface SavedStudent {
  _id: string;
  rollCode?: string;
  rollNumber: string;
  name: string;
  mobileNumber?: string;
  fatherName?: string;
  school?: string;
  faculty?: string;
  subjects: Record<string, number | null>;
  subjectCategories?: Record<string, string>;
  total?: number | null;
  percentage?: number | null;
  division?: string;
  status?: string;
  board?: string;
  batch?: string;
  savedAt?: string;
}

export default function SavedDataPage() {
  const [students, setStudents] = useState<SavedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const [batch, setBatch] = useState("");
  const [search, setSearch] = useState("");
  const [batches, setBatches] = useState<string[]>([]);
  const limit = 50;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("board", "BIHAR");
      if (batch) params.set("batch", batch);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/students?${params.toString()}`);
      const json = await res.json();

      const savedOnly = (json.data ?? []).filter(
        (s: SavedStudent) => s.savedAt
      );
      if (!cancelled) {
        setStudents(savedOnly);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, batch, search]);

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then((data) => setBatches(data.batches ?? []));
  }, []);

  function handleExport() {
    const rows = students.map((s, idx) => {
      const row: Record<string, string | number | null> = {
        "S.No": idx + 1,
        Name: s.name,
        "Roll Code": s.rollCode || "",
        "Roll No": s.rollNumber,
        Mobile: s.mobileNumber || "",
        "Father Name": s.fatherName || "",
        School: s.school || "",
        Faculty: s.faculty || "",
      };
      const subjectKeys = Object.keys(s.subjects || {}).sort();
      for (const key of subjectKeys) {
        row[key.replace(/_/g, " ")] = s.subjects[key];
      }
      
      // Add a column listing optional/additional subjects
      const categories = s.subjectCategories || {};
      const optionalSubjects = subjectKeys
        .filter(key => categories[key] === 'elective' || categories[key] === 'additional')
        .map(key => key.replace(/_/g, " "))
        .join(", ");
      if (optionalSubjects) {
        row["Optional Subjects"] = optionalSubjects;
      }
      
      row["Total"] = s.total ?? null;
      row["%"] = s.percentage ?? null;
      row["Division"] = s.division || "";
      row["Status"] = s.status || "";
      row["Board"] = s.board || "";
      row["Batch"] = s.batch || "";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Saved Results");
    XLSX.writeFile(wb, `BSEB_Saved_Results_${batch || "all"}.xlsx`);
  }

  async function handleClear() {
    if (
      !confirm(
        "Are you sure you want to clear all saved data? This cannot be undone."
      )
    )
      return;
    setClearing(true);
    const params = new URLSearchParams();
    params.set("board", "BIHAR");
    if (batch) params.set("batch", batch);

    await fetch(`/api/clear-results?${params.toString()}`, {
      method: "DELETE",
    });
    setClearing(false);
    setPage(1);
  }

  const subjectKeys = (() => {
    const keys = new Set<string>();
    for (const s of students) {
      for (const k of Object.keys(s.subjects || {})) {
        keys.add(k);
      }
    }
    return [...keys].sort();
  })();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/bihar"
              className="text-blue-600 hover:text-blue-800 text-sm mb-1 inline-block"
            >
              Back to Bihar Board
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Saved Results
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={students.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              Export Excel
            </button>
            <button
              onClick={handleClear}
              disabled={clearing || students.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              {clearing ? "Clearing..." : "Clear All"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border flex flex-wrap gap-3 items-center">
          <select
            value={batch}
            onChange={(e) => {
              setBatch(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input
            className="border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px] text-gray-700"
            placeholder="Search by name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setPage(1)}
          />
          <button
            onClick={() => setPage(1)}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-2">
          Showing {students.length} saved records
        </p>

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Roll No
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Name
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Roll Code
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Mobile
                </th>
                {subjectKeys.map((k) => (
                  <th
                    key={k}
                    className="px-3 py-2 text-center whitespace-nowrap bg-purple-700 text-xs uppercase"
                  >
                    {k.replace(/_/g, " ")}
                  </th>
                ))}
                <th className="px-3 py-2 text-center whitespace-nowrap bg-green-700 text-xs uppercase">
                  Total
                </th>
                <th className="px-3 py-2 text-center whitespace-nowrap bg-blue-700 text-xs uppercase">
                  %
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Division
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Status
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase">
                  Batch
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={20}
                    className="text-center py-8 text-gray-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={20}
                    className="text-center py-8 text-gray-400"
                  >
                    No saved results. Fetch results from the Bihar Board page
                    to save them here.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s._id}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-mono text-gray-900">
                      {s.rollNumber}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px] truncate">
                      {s.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {s.rollCode || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {s.mobileNumber || "—"}
                    </td>
                    {subjectKeys.map((k) => (
                      <td
                        key={k}
                        className="px-3 py-2 text-center font-mono text-gray-700"
                      >
                        {s.subjects?.[k] ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-bold text-gray-900">
                      {s.total ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`font-medium ${
                          (s.percentage ?? 0) >= 60
                            ? "text-green-600"
                            : (s.percentage ?? 0) >= 33
                            ? "text-yellow-600"
                            : "text-red-500"
                        }`}
                      >
                        {s.percentage != null
                          ? s.percentage.toFixed(1)
                          : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {s.division || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          s.status?.toUpperCase() === "PASS"
                            ? "bg-green-100 text-green-700"
                            : s.status?.toUpperCase() === "FAIL"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {s.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {s.batch || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100 text-gray-700"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={students.length < limit}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100 text-gray-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
