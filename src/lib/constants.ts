export const FIXED_COLUMNS = new Set([
  "rollnumber",
  "roll_number",
  "roll no",
  "rollno",
  "rolln",
  "name",
  "student name",
  "mobile",
  "mobilenumber",
  "mobile number",
  "phone",
  "district",
  "school",
  "total",
  "percentage",
  "percent",
  "division",
  "status",
  "result",
  "batch",
  "year",
  "board",
  "bord",
  "rollcode",
  "rolcode",
]);

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapFixedHeader(raw: string): string | null {
  const n = normalizeHeader(raw);
  if (["rollnumber", "rollno", "rolln"].some((k) => n.includes(k)))
    return "rollNumber";
  if (n === "name" || n === "studentname") return "name";
  if (n.includes("mobile") || n.includes("phone")) return "mobileNumber";
  if (n === "board" || n === "bord") return "board";
  if (["rollcode", "rolcode"].some((k) => n.includes(k))) return "rollCode";
  if (n.includes("district")) return "district";
  if (n.includes("school")) return "school";
  if (n === "total") return "total";
  if (n.includes("percent")) return "percentage";
  if (n.includes("division")) return "division";
  if (n.includes("status") || n === "result") return "status";
  if (n === "batch" || n === "year") return "batch";
  return null;
}
