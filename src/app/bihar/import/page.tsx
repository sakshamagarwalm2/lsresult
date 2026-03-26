"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState(String(new Date().getFullYear()));
  const [board, setBoard] = useState("BIHAR");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    inserted?: number;
    modified?: number;
    total?: number;
    skipped?: number;
    subjectsDiscovered?: string[];
    error?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file) return alert("Please select a file first");
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("batch", batch);
      fd.append("board", board);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto">
        <Link
          href="/bihar"
          className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block"
        >
          &larr; Back to Bihar Board
        </Link>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">
            Import Results
          </h1>

          <label className="block mb-1 text-sm font-medium text-gray-700">
            Board
          </label>
          <input
            type="text"
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-4 text-gray-900"
            placeholder="e.g. BIHAR"
          />

          <label className="block mb-1 text-sm font-medium text-gray-700">
            Batch Year
          </label>
          <input
            type="text"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-4 text-gray-900"
            placeholder="e.g. 2024"
          />

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 transition mb-4"
          >
            {file ? (
              <p className="text-green-600 font-medium">{file.name}</p>
            ) : (
              <p className="text-gray-400">
                Drop .xlsx file here or click to browse
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            onClick={handleImport}
            disabled={loading || !file}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
          >
            {loading ? "Importing..." : "Import"}
          </button>

          {result && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                result.error
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-800"
              }`}
            >
              {result.error ? (
                <p>{result.error}</p>
              ) : (
                <>
                  <p>
                    Total rows processed: <strong>{result.total}</strong>
                    {result.skipped && result.skipped > 0 && (
                      <span className="text-yellow-600 ml-2">
                        ({result.skipped} skipped — missing roll number)
                      </span>
                    )}
                  </p>
                  <p>
                    New records: <strong>{result.inserted}</strong>
                  </p>
                  <p>
                    Updated records: <strong>{result.modified}</strong>
                  </p>
                  {result.subjectsDiscovered &&
                    result.subjectsDiscovered.length > 0 && (
                      <p>
                        Subjects discovered:{" "}
                        <strong>
                          {result.subjectsDiscovered.join(", ")}
                        </strong>
                      </p>
                    )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
