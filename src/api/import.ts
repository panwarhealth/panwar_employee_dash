import { apiFetch } from './client';

export interface ImportUploadUrl {
  uploadUrl: string;
  objectKey: string;
}

export interface ImportFileRef {
  objectKey: string;
  fileName: string;
  contentHash?: string | null;
  formatId?: string | null;
}

export type Outcome = 'match' | 'change' | 'new' | 'invalid';
export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export interface AlreadyImported {
  date: string;
  by: string | null;
}

export interface ImportSource {
  file: string;
  objectKey: string;
  formatId: string;
  match: string;
  contentHash: string;
  alreadyImported: AlreadyImported | null;
  warnings: string[];
}

export interface ImportHeadline {
  match: number;
  change: number;
  new: number;
  invalid: number;
  unmatchedPlacements: number;
  totalValues: number;
}

export interface PlacementCandidate {
  placementId: string;
  name: string;
  template: string;
}

export interface ActualDiff {
  metric: string;
  month: number;
  newValue: number;
  oldValue: number | null;
  outcome: Outcome;
  note: string | null;
}

export interface PlacementDiff {
  source: string;
  parsedName: string;
  brand: string;
  audience: string | null;
  publisher: string;
  template: string;
  objective: string;
  matchStatus: MatchStatus;
  placementId: string | null;
  matchedName: string | null;
  matchedByMemory: boolean;
  candidates: PlacementCandidate[];
  rows: ActualDiff[];
  notes: string[];
  needsReview: boolean;
  reviewReasons: string[];
  suggestions: PlacementSuggestion[];
  sourceViews: SourceView[];
}

// A spreadsheet-style excerpt straight from the uploaded file (the cells the AI used).
export interface SourceView {
  sheet: string;
  tabs: string[];
  rows: SourceGridRow[];
}
export interface SourceGridRow {
  row: number;
  cells: SourceGridCell[];
}
export interface SourceGridCell {
  col: string;
  value: string;
  highlight: boolean;
}

// AI per-send proposal for a flagged block (empty when the AI layer is off).
export interface PlacementSuggestion {
  month: number;
  topicLabel: string;
  targetPlacementId: string | null;
  targetName: string | null;
  reason: string;
  confidence: number;
  values: SuggestionValue[];
  sendDates: string[]; // eDM send dates the AI read from the note (ISO yyyy-MM-dd)
  evidence: { sheet: string; cell: string }[]; // cells that told the AI when/what - highlighted in the grids
}

// A value the AI pulled from a specific cell that passed the grounding check.
export interface SuggestionValue {
  metric: string;
  value: number;
  sourceSheet: string;
  sourceCell: string;
}

export interface EducationCandidate {
  assetId: string;
  pageId: string;
  pageName: string;
  title: string;
}

export interface EducationValueDiff {
  status: string;
  year: number;
  month: number;
  newValue: number;
  oldValue: number | null;
  outcome: Outcome;
}

export interface EducationDiff {
  source: string;
  group: string | null; // publisher block heading from the file ("AP", "Pharmacy Club")
  brand: string;
  type: string | null;
  title: string;
  author: string | null;
  expiry: string | null;
  matchStatus: MatchStatus;
  assetId: string | null;
  pageId: string | null;
  pageName: string | null;
  candidates: EducationCandidate[];
  rows: EducationValueDiff[];
}

export interface ImportPreview {
  year: number;
  sources: ImportSource[];
  headline: ImportHeadline;
  placements: PlacementDiff[];
  education: EducationDiff[];
  warnings: string[];
  aiEnabled: boolean;
  aiFailed: boolean;
}

export interface CommitActual {
  year: number;
  month: number;
  metricKey: string;
  value: number;
  note: string | null;
}

export interface NewPlacementSpec {
  brand: string;
  publisher: string;
  audience: string | null;
  template: string;
  name: string;
  objective: string;
}

export interface CommitPlacement {
  source: string;
  parsedName?: string | null; // the file's block name - lets the backend remember the mapping
  placementId?: string | null;
  newPlacement?: NewPlacementSpec | null;
  actuals: CommitActual[];
  sendDates?: string[]; // eDM send dates to store on the placement (ISO yyyy-MM-dd)
}

export interface CommitEducationValue {
  status: string;
  year: number;
  month: number;
  value: number;
}

export interface NewEducationAsset {
  pageId: string;
  group: string | null;
  brand: string;
  type: string | null;
  title: string;
  author: string | null;
}

export interface CommitEducation {
  assetId: string | null;
  values: CommitEducationValue[];
  expiry?: string | null; // ISO yyyy-MM-dd expiry date to store on the asset
  newAsset?: NewEducationAsset | null;
}

export interface ImportCommitResult {
  placementsWritten: number;
  valuesWritten: number;
  educationAssetsWritten: number;
  educationValuesWritten: number;
}

export const requestImportUploadUrl = (
  clientSlug: string,
  body: { fileName: string; contentType: string },
): Promise<ImportUploadUrl> =>
  apiFetch<ImportUploadUrl>(`/manage/clients/${clientSlug}/import/upload-url`, {
    method: 'POST',
    body,
  });

// Kicks off the preview build as a background job (the AI can run for minutes,
// longer than a request may stay open) - poll getImportJob for status + result.
export const startImportPreview = (
  clientSlug: string,
  body: { year: number; files: ImportFileRef[]; jobId: string },
): Promise<{ jobId: string }> =>
  apiFetch<{ jobId: string }>(`/manage/clients/${clientSlug}/import/preview`, {
    method: 'POST',
    body,
  });

export interface ImportJobState {
  status: 'running' | 'done' | 'failed' | 'unknown';
  message: string | null;
  preview: ImportPreview | null;
  error: string | null;
}

export const getImportJob = (clientSlug: string, jobId: string): Promise<ImportJobState> =>
  apiFetch<ImportJobState>(`/manage/clients/${clientSlug}/import/progress/${jobId}`);

export const commitImport = (
  clientSlug: string,
  body: {
    year: number;
    files: ImportFileRef[];
    placements: CommitPlacement[];
    education: CommitEducation[];
    acknowledged: boolean;
  },
): Promise<ImportCommitResult> =>
  apiFetch<ImportCommitResult>(`/manage/clients/${clientSlug}/import/commit`, {
    method: 'POST',
    body,
  });
