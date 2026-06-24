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
  candidates: PlacementCandidate[];
  rows: ActualDiff[];
  notes: string[];
  needsReview: boolean;
  reviewReasons: string[];
  suggestions: PlacementSuggestion[];
}

// AI per-send proposal for a flagged block (empty when the AI layer is off).
export interface PlacementSuggestion {
  month: number;
  topicLabel: string;
  targetPlacementId: string | null;
  targetName: string | null;
  reason: string;
  confidence: number;
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
  placementId?: string | null;
  newPlacement?: NewPlacementSpec | null;
  actuals: CommitActual[];
}

export interface CommitEducationValue {
  status: string;
  year: number;
  month: number;
  value: number;
}

export interface CommitEducation {
  assetId: string;
  values: CommitEducationValue[];
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

export const buildImportPreview = (
  clientSlug: string,
  body: { year: number; files: ImportFileRef[] },
): Promise<ImportPreview> =>
  apiFetch<ImportPreview>(`/manage/clients/${clientSlug}/import/preview`, {
    method: 'POST',
    body,
  });

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
