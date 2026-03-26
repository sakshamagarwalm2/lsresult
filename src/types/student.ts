export interface SubjectScore {
  [subjectKey: string]: number | null;
}

export interface Student {
  _id: string;
  rollNumber: string;
  rollCode?: string;
  name: string;
  mobileNumber?: string;
  district?: string;
  school?: string;
  total?: number | null;
  percentage?: number | null;
  division?: string;
  status?: string;
  board?: string;
  batch?: string;
  subjects: SubjectScore;
  importedAt?: string;
}

export interface SubjectMeta {
  name: string;
  displayName: string;
  batches: string[];
}

export interface FilterOptions {
  batches: string[];
  districts: string[];
  divisions: string[];
  statuses: string[];
}

export interface ColumnVisibility {
  rollNumber: boolean;
  rollCode: boolean;
  name: boolean;
  mobileNumber: boolean;
  district: boolean;
  school: boolean;
  total: boolean;
  percentage: boolean;
  division: boolean;
  status: boolean;
  board: boolean;
  batch: boolean;
  importedAt: boolean;
  [key: string]: boolean;
}
