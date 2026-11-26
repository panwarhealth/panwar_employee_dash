import { apiFetch } from './client';

export interface JobBoardVote {
  choice: string;
  comment: string | null;
  voterName: string;
  updatedAt: string;
}

export interface JobBoardVoteState {
  mine: JobBoardVote | null;
  all: JobBoardVote[] | null;
}

export const getJobBoardVote = (): Promise<JobBoardVoteState> => apiFetch<JobBoardVoteState>('/job-board-vote');

export const saveJobBoardVote = (body: { choice: string; comment: string | null }): Promise<JobBoardVote> =>
  apiFetch<JobBoardVote>('/job-board-vote', { method: 'PUT', body });
