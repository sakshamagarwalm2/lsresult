"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import type {
  Student,
  SubjectMeta,
  FilterOptions,
  ColumnVisibility,
} from "@/types/student";

const DEFAULT_FIXED_COLS: string[] = [
  "rollCode",
  "rollNumber",
  "name",
  "mobileNumber",
  "total",
  "percentage",
  "division",
  "status",
];

export default function ResultsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [subjects, setSubjects] = useState<SubjectMeta[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    batches: [],
    districts: [],
    divisions: [],
    statuses: [],
  });

  const [batch, setBatch] = useState("");
  const [district, setDistrict] = useState("");
  const [division, setDivision] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [minPercent, setMinPercent] = useState("");
  const [maxPercent, setMaxPercent] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const [colVis, setColVis] = useState<ColumnVisibility>({
    rollNumber: true,
    rollCode: true,
    name: true,
    mobileNumber: true,
    district: false,
    school: false,
    total: true,
    percentage: true,
    division: true,
    status: true,
    board: false,
    batch: false,
    importedAt: false,
  });
  const [showColChooser, setShowColChooser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Scraper State
  const [captchaCode, setCaptchaCode] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [cookies, setCookies] = useState<Record<string, string>>({});
  const [captchaInput, setCaptchaInput] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  };

  const fetchInitialData = async () => {
    setCaptchaLoading(true);
    addLog('Fetching initial data from BSEB...');
    try {
      const res = await fetch('/api/result', { method: 'GET' });
      const data = await res.json();
      if (data.csrfToken) {
        setCaptchaCode(data.captchaCode || '');
        setCsrfToken(data.csrfToken);
        setCookies(data.cookies);
        addLog(`Captcha Code: ${data.captchaCode}`);
      } else {
        addLog('Error: No CSRF token received');
      }
    } catch (error) {
      addLog(`Error fetching initial data: ${error}`);
    } finally {
      setCaptchaLoading(false);
    }
  };

  const parseResultHtml = (html: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const getText = (label: string): string => {
        // Find the td that contains the label in the student info table
        const tables = doc.querySelectorAll('table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length === 2 && cells[0].textContent?.includes(label)) {
              return cells[1].textContent?.trim() || '';
            }
          }
        }
        return '';
      };

      const bsebUniqueId = getText('BSEB Unique Id');
      const studentName = getText("Student's Name");
      const fatherName = getText("Father's Name");
      const schoolName = getText('School/College Name');
      const rollCode = getText('Roll Code');
      const rollNumber = getText('Roll Number');
      const registrationNumber = getText('Registration Number');
      const faculty = getText('Faculty');

      console.log("Parsed student info:", { studentName, fatherName, rollCode, rollNumber });

      const subjects: Record<string, number | null> = {};
      const subjectCategories: Record<string, string> = {};
      
      // Track current category while parsing
      let currentCategory = '';
      
      // Find the marks table - it has rows with 8 td elements
      const rows = doc.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        
        // Check if this is a category header row (has colspan)
        if (cells.length === 1 && cells[0].classList.contains('subject-group-header')) {
          const text = cells[0].textContent || '';
          if (text.includes('अनिवार्य') || text.includes('Compulsory')) {
            currentCategory = 'compulsory';
          } else if (text.includes('ऐच्छिक') || text.includes('Elective')) {
            currentCategory = 'elective';
          } else if (text.includes('अतिरिक्त') || text.includes('Additional')) {
            currentCategory = 'additional';
          }
          return;
        }
        
        if (cells.length === 8) {
          const subjectName = cells[0].textContent?.trim();
          const subjectTotalStr = cells[7].textContent?.trim();
          
          if (subjectName && subjectTotalStr && subjectName !== 'Subject' && !subjectName.includes('अनिवार्य') && !subjectName.includes('ऐच्छिक') && !subjectName.includes('अतिरिक्त') && !subjectName.includes('Compulsory') && !subjectName.includes('Elective') && !subjectName.includes('Additional')) {
             const numMatch = subjectTotalStr.match(/^(\d+)/);
             if (numMatch) {
               const key = subjectName.toUpperCase().replace(/\s+/g, "_");
               subjects[key] = parseInt(numMatch[1]) || 0;
               subjectCategories[key] = currentCategory || 'unknown';
             }
          }
        }
      });

      console.log("Parsed subjects:", subjects, "categories:", subjectCategories);

      const aggregateMarksRaw = getText('Aggregate Marks');
      const resultDivision = getText('Result/Division');

      const marksMatch = aggregateMarksRaw.match(/(\d+)/);
      const aggregateMarks = marksMatch ? marksMatch[1] : '0';
      const percentage = marksMatch ? (parseInt(marksMatch[1]) / 500) * 100 : 0;

      console.log("Parsed result:", { aggregateMarks, resultDivision, percentage });

      return {
        rollCode,
        rollNumber,
        name: studentName,
        schoolName,
        mobile: '',
        fatherName,
        faculty,
        registrationNumber,
        total: Number(aggregateMarks),
        percentage: Math.round(percentage * 100) / 100,
        division: resultDivision,
        status: resultDivision.toLowerCase().includes("pass") ? "PASS" : resultDivision.toLowerCase().includes("fail") ? "FAIL" : "UNKNOWN",
        subjects,
        subjectCategories,
        batch: batch || String(new Date().getFullYear()),
        board: "BIHAR",
        savedAt: new Date().toISOString()
      };
    } catch (error) {
      addLog(`Error parsing result HTML: ${error}`);
      return null;
    }
  };

  const handleFetchResult = async (student: Student, captcha: string) => {
    addLog(`Fetching result for: ${student.rollNumber}`);
    try {
      const res = await fetch('/api/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollCode: student.rollCode,
          rollNo: student.rollNumber,
          captcha,
          csrfToken,
          cookies,
        }),
      });

      const data = await res.json();
      if (data.success && data.html) {
        const resultData = parseResultHtml(data.html);
        if (resultData) {
          addLog(`Result parsed for ${resultData.name}. Saving...`);
          
          // Ensure the payload matches what we send to save-results API
           const savePayload = {
              rollCode: student.rollCode,
              rollNumber: student.rollNumber,
              name: resultData.name,
              mobile: student.mobileNumber || '',
              fatherName: resultData.fatherName || '',
              schoolName: resultData.schoolName || student.school || '',
              faculty: resultData.faculty || '',
              registrationNumber: resultData.registrationNumber || '',
              subjects: resultData.subjects,
              subjectCategories: resultData.subjectCategories,
              total: resultData.total,
              percentage: resultData.percentage,
              division: resultData.division,
              board: resultData.board,
              batch: resultData.batch,
           };

          const saveRes = await fetch('/api/save-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(savePayload),
          });
          if (saveRes.ok) {
            addLog(`Saved ${resultData.name} to database`);
            load(); // Reload the list
          } else {
            const errorData = await saveRes.json();
            addLog(`Failed to save: ${JSON.stringify(errorData)}`);
          }
        }
      } else {
        addLog(`API error: ${data.error || 'Failed'}`);
      }
    } catch (error) {
      addLog(`Fetch error: ${error}`);
    }
  };

  const handleGetBtn = async (student: Student) => {
    setSelectedStudent(student);
    setCaptchaInput('');
    setShowModal(true);
    fetchInitialData();
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    addLog(`Importing Excel: ${file.name}`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("batch", batch || String(new Date().getFullYear()));
      fd.append("board", "BIHAR");
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        addLog(`Imported ${json.total} records!`);
        load();
      } else {
        addLog(`Import error: ${json.error}`);
      }
    } catch (e) {
      addLog(`Import failed: ${e}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to completely clear the database? This action cannot be undone.")) return;

    try {
      addLog("Clearing all records...");
      const res = await fetch(`/api/clear-results?board=BIHAR${batch ? `&batch=${batch}` : ""}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Successfully cleared ${data.deleted} records.`);
        load();
      } else {
        addLog(`Failed to clear: ${data.error}`);
      }
    } catch (err: unknown) {
        addLog(`Error clearing data: ${err}`);
    }
  };

  const handleExport = () => {
    if (students.length === 0) return;

    const exportData = students.map((s) => {
      const row: Record<string, string | number> = {};
      DEFAULT_FIXED_COLS.forEach((key) => {
        if (colVis[key]) {
          const label = FIXED_COL_DEFS.find((c) => c.key === key)?.label || key;
          row[label] = s[key as keyof Student] as string | number;
        }
      });
      if (colVis.district) row["District"] = s.district || "";
      if (colVis.school) row["School"] = s.school || "";
      if (colVis.board) row["Board"] = s.board || "";
      if (colVis.batch) row["Batch"] = s.batch || "";
      
      visibleSubjectCols.forEach((sub) => {
        row[sub.displayName] = s.subjects?.[sub.name] ?? "";
      });
      
      if (colVis.importedAt) {
        row["Imported"] = s.importedAt ? "Yes" : "No";
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
    
    let fileName = "Bihar_Board_Results";
    if (batch) fileName += `_${batch}`;
    fileName += ".xlsx";

    XLSX.writeFile(workbook, fileName);
  };


  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (batch) params.set("batch", batch);
    params.set("board", "BIHAR");
    if (district) params.set("district", district);
    if (division) params.set("division", division);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (minPercent) params.set("minPercent", minPercent);
    if (maxPercent) params.set("maxPercent", maxPercent);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`/api/students?${params.toString()}`);
    const json = await res.json();
    setStudents(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }

  function handleApply() {
    setPage(1);
  }

  function handleReset() {
    setBatch("");
    setDistrict("");
    setDivision("");
    setStatus("");
    setSearch("");
    setMinPercent("");
    setMaxPercent("");
    setPage(1);
  }

  const visibleSubjectCols = subjects.filter((s) => colVis[s.name]);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const FIXED_COL_DEFS = [
    { key: "rollNumber", label: "Roll No" },
    { key: "rollCode", label: "Roll Code" },
    { key: "name", label: "Name" },
    { key: "mobileNumber", label: "Mobile" },
    { key: "district", label: "District" },
    { key: "school", label: "School" },
    { key: "board", label: "Board" },
    { key: "batch", label: "Batch" },
    { key: "total", label: "Total" },
    { key: "percentage", label: "Percentage" },
    { key: "division", label: "Division" },
    { key: "status", label: "Status" },
    { key: "importedAt", label: "Import" },
  ];

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then((data: SubjectMeta[]) => {
        setSubjects(data);
        setColVis((prev) => {
          const next = { ...prev };
          data.forEach((s) => {
            if (!(s.name in next)) next[s.name] = true;
          });
          return next;
        });
      });

    fetch("/api/filters")
      .then((r) => r.json())
      .then(setFilterOptions);
    
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/bihar"
              className="text-blue-600 hover:text-blue-800 text-sm mb-1 inline-block"
            >
              &larr; Back to Bihar Board
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Bihar Board Results
            </h1>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileUpload}
              className="hidden"
              accept=".xlsx,.xls"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
            >
              {importing ? "Importing..." : "Import Excel"}
            </button>
            <button
              onClick={handleExport}
              disabled={students.length === 0}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium"
            >
              Export Excel
            </button>
            <button
              onClick={handleClearData}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 font-medium"
            >
              Clear Data
            </button>
            <button
              onClick={() => setShowColChooser((v) => !v)}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 text-gray-700 font-medium border"
            >
              Columns
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Batches</option>
            {filterOptions.batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Districts</option>
            {filterOptions.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Divisions</option>
            {filterOptions.divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Status</option>
            {filterOptions.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            className="border rounded-lg px-2 py-1.5 text-sm col-span-2 text-gray-700"
            placeholder="Search by name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />

          <div className="flex gap-2 items-center col-span-2">
            <span className="text-sm text-gray-500">%</span>
            <input
              type="number"
              className="border rounded-lg px-2 py-1.5 text-sm w-20 text-gray-700"
              placeholder="Min"
              value={minPercent}
              onChange={(e) => setMinPercent(e.target.value)}
            />
            <span className="text-sm text-gray-400">to</span>
            <input
              type="number"
              className="border rounded-lg px-2 py-1.5 text-sm w-20 text-gray-700"
              placeholder="Max"
              value={maxPercent}
              onChange={(e) => setMaxPercent(e.target.value)}
            />
          </div>

          <div className="flex gap-2 col-span-2 md:col-span-4">
            <button
              onClick={handleApply}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-1.5 bg-gray-200 rounded-lg text-sm hover:bg-gray-300 text-gray-700"
            >
              Reset
            </button>
          </div>
        </div>

        {logMessages.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-3 rounded-xl mb-4 font-mono text-xs max-h-32 overflow-y-auto border border-gray-800 shadow-inner">
            <div className="flex justify-between items-center mb-1 text-gray-500 uppercase tracking-widest text-[10px] font-bold">
              <span>Console Log</span>
              <button onClick={() => setLogMessages([])} className="hover:text-red-400">Clear</button>
            </div>
            {logMessages.map((m, i) => (
              <div key={i} className="mb-0.5">{m}</div>
            ))}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-2">
          Showing {students.length} of {total} students
        </p>

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                {DEFAULT_FIXED_COLS.map(
                  (key) =>
                    colVis[key] && (
                      <th
                        key={key}
                        className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase tracking-wide"
                      >
                        {
                          FIXED_COL_DEFS.find((c) => c.key === key)?.label
                        }
                      </th>
                    )
                )}
                {colVis.district && (
                  <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase tracking-wide">
                    District
                  </th>
                )}
                {colVis.school && (
                  <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase tracking-wide">
                    School
                  </th>
                )}
                {colVis.board && (
                  <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase tracking-wide">
                    Board
                  </th>
                )}
                {colVis.batch && (
                  <th className="px-3 py-2 text-left whitespace-nowrap text-xs uppercase tracking-wide">
                    Batch
                  </th>
                )}
                <th className="px-3 py-2 text-center whitespace-nowrap text-xs uppercase tracking-wide">
                  Action
                </th>
                {visibleSubjectCols.map((s) => (
                  <th
                    key={s.name}
                    className="px-3 py-2 text-center whitespace-nowrap bg-purple-700 text-xs uppercase tracking-wide"
                  >
                    {s.displayName}
                  </th>
                ))}
                {colVis.importedAt && (
                  <th className="px-3 py-2 text-center whitespace-nowrap text-xs uppercase tracking-wide">
                    Imported
                  </th>
                )}
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
                    No results found. Import an Excel file first.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s._id}
                    className="border-t hover:bg-gray-50"
                  >
                    {colVis.rollCode && (
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {s.rollCode || "—"}
                      </td>
                    )}
                    {colVis.rollNumber && (
                      <td className="px-3 py-2 font-mono text-gray-900">
                        {s.rollNumber}
                      </td>
                    )}
                    {colVis.name && (
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px] truncate">
                        {s.name}
                      </td>
                    )}
                    {colVis.mobileNumber && (
                      <td className="px-3 py-2 text-gray-700">
                        {s.mobileNumber || "—"}
                      </td>
                    )}
                    {colVis.total && (
                      <td className="px-3 py-2 text-center font-bold text-gray-900">
                        {s.total ?? "—"}
                      </td>
                    )}
                    {colVis.percentage && (
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
                    )}
                    {colVis.division && (
                      <td className="px-3 py-2 text-gray-700">
                        {s.division || "—"}
                      </td>
                    )}
                    {colVis.status && (
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
                    )}
                    {colVis.district && (
                      <td className="px-3 py-2 text-gray-700">
                        {s.district || "—"}
                      </td>
                    )}
                    {colVis.school && (
                      <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                        {s.school || "—"}
                      </td>
                    )}
                    {colVis.board && (
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {s.board || "—"}
                        </span>
                      </td>
                    )}
                    {colVis.batch && (
                      <td className="px-3 py-2 text-gray-700">
                        {s.batch || "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-center">
                       <button
                         onClick={() => handleGetBtn(s)}
                         className="px-2 py-1 bg-blue-600 text-white rounded text-xs transition active:scale-95 hover:bg-blue-700"
                       >
                         Get
                       </button>
                    </td>
                    {visibleSubjectCols.map((sub) => (
                      <td
                        key={sub.name}
                        className="px-3 py-2 text-center font-mono text-gray-700"
                      >
                        {s.subjects?.[sub.name] ?? "—"}
                      </td>
                    ))}
                    {colVis.importedAt && (
                      <td className="px-3 py-2 text-center">
                        {s.importedAt ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Imported
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    )}
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
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100 text-gray-700"
          >
            Next
          </button>
        </div>

        {showColChooser && (
          <div
            className="fixed inset-0 bg-black/30 z-50 flex items-start justify-end"
            onClick={() => setShowColChooser(false)}
          >
            <div
              className="bg-white w-72 h-full overflow-y-auto p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-semibold text-lg mb-4 text-gray-900">
                Show / Hide Columns
              </h2>

              <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                Fixed Fields
              </p>
              {FIXED_COL_DEFS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 py-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!colVis[key]}
                    onChange={(e) =>
                      setColVis((v) => ({ ...v, [key]: e.target.checked }))
                    }
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}

              <p className="text-xs uppercase tracking-wide text-gray-400 mt-4 mb-2">
                Subjects
              </p>
              {subjects.length === 0 && (
                <p className="text-sm text-gray-400 py-1">
                  No subjects imported yet
                </p>
              )}
              {subjects.map((s) => (
                <label
                  key={s.name}
                  className="flex items-center gap-2 py-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!colVis[s.name]}
                    onChange={(e) =>
                      setColVis((v) => ({
                        ...v,
                        [s.name]: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-gray-700">
                    {s.displayName}
                  </span>
                </label>
              ))}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    const all: ColumnVisibility = { ...colVis };
                    Object.keys(all).forEach((k) => (all[k] = true));
                    subjects.forEach((s) => (all[s.name] = true));
                    setColVis(all);
                  }}
                  className="flex-1 text-xs py-1.5 border rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    const none: ColumnVisibility = { ...colVis };
                    Object.keys(none).forEach((k) => (none[k] = false));
                    setColVis(none);
                  }}
                  className="flex-1 text-xs py-1.5 border rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border-2 border-blue-200 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Enter Captcha</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setCaptchaInput('');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">Roll No: {selectedStudent?.rollNumber}</p>
              
              {captchaLoading ? (
                <div className="text-center py-6">
                  <div className="animate-spin inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mb-3"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              ) : captchaCode ? (
                <div className="mb-4">
                  <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-5 text-center">
                    <p className="text-sm text-blue-600 mb-2">Enter this code:</p>
                    <p className="text-4xl font-bold tracking-widest text-blue-800">{captchaCode}</p>
                  </div>
                  <button
                    onClick={fetchInitialData}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline block w-full text-center"
                  >
                    Refresh Captcha
                  </button>
                </div>
              ) : (
                <div className="mb-4 text-center py-6 text-gray-600">
                  <p className="mb-2">Failed to load captcha</p>
                  <button onClick={fetchInitialData} className="text-blue-600 hover:text-blue-800">Try Again</button>
                </div>
              )}
              
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && captchaInput && !captchaLoading && selectedStudent) {
                    handleFetchResult(selectedStudent, captchaInput);
                    setShowModal(false);
                  }
                }}
                placeholder="Enter code"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 text-xl text-center tracking-widest text-gray-900 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setCaptchaInput('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedStudent) handleFetchResult(selectedStudent, captchaInput);
                    setShowModal(false);
                  } }
                  disabled={!captchaInput || captchaLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
