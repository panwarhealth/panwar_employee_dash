import { apiFetch, apiFetchBlob } from "./client";
import type { CourseDoc } from "@/course/doc";

export interface CourseSummary {
  id: string;
  title: string;
  updatedAt: string;
  updatedByName: string | null;
  lastExportedAt: string | null;
}

export interface Course {
  id: string;
  title: string;
  content: CourseDoc;
  updatedAt: string;
  lastExportedAt: string | null;
}

export const listCourses = (): Promise<CourseSummary[]> =>
  apiFetch<{ courses: CourseSummary[] }>("/courses").then((r) => r.courses);

export const getCourse = (id: string): Promise<Course> =>
  apiFetch(`/courses/${id}`);

export const createCourse = (content: CourseDoc): Promise<Course> =>
  apiFetch("/courses", {
    method: "POST",
    body: { title: content.title, content },
  });

export const saveCourse = (id: string, content: CourseDoc): Promise<Course> =>
  apiFetch(`/courses/${id}`, {
    method: "PUT",
    body: { title: content.title, content },
  });

export const deleteCourse = (id: string, title: string): Promise<void> =>
  apiFetch(`/courses/${id}?title=${encodeURIComponent(title)}`, {
    method: "DELETE",
  });

export const markExported = (id: string): Promise<Course> =>
  apiFetch(`/courses/${id}/exported`, { method: "POST" });

export const uploadMedia = (id: string, file: File): Promise<{ url: string }> =>
  apiFetch(`/courses/${id}/media?filename=${encodeURIComponent(file.name)}`, {
    method: "PUT",
    body: file,
  });

export const downloadMedia = (id: string, url: string): Promise<Blob> =>
  apiFetchBlob(`/courses/${id}/media?url=${encodeURIComponent(url)}`);

export interface AssistantBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string | unknown[];
}

export interface AssistantReply {
  content: AssistantBlock[];
  stop_reason: string | null;
  usage?: { cost_usd?: number | null };
}

interface AssistantJob {
  status: "running" | "done" | "failed" | "unknown";
  message: string | null;
  reply: AssistantReply | null;
  error: string | null;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

export async function assistantTurn(
  id: string,
  body: { system: string; tools: unknown[]; messages: AssistantMessage[] },
  onStatus: (message: string) => void,
  signal?: AbortSignal,
): Promise<AssistantReply> {
  const { jobId } = await apiFetch<{ jobId: string }>(
    `/courses/${id}/assistant`,
    {
      method: "POST",
      body,
      signal,
    },
  );
  for (;;) {
    await wait(1500, signal);
    const job = await apiFetch<AssistantJob>(
      `/courses/${id}/assistant/${jobId}`,
      { signal },
    );
    if (job.status === "done" && job.reply) return job.reply;
    if (job.status === "failed")
      throw new Error(job.error ?? "The AI request failed.");
    if (job.status === "unknown")
      throw new Error("The server lost track of this request. Try again.");
    if (job.message) onStatus(job.message);
  }
}

export const importMedia = (
  id: string,
  url: string,
): Promise<{ url: string }> =>
  apiFetch(`/courses/${id}/media/import`, { method: "POST", body: { url } });
