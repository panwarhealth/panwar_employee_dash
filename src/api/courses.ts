import { apiFetch, apiFetchBlob } from './client';
import type { CourseDoc } from '@/course/doc';

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
  apiFetch<{ courses: CourseSummary[] }>('/courses').then((r) => r.courses);

export const getCourse = (id: string): Promise<Course> => apiFetch(`/courses/${id}`);

export const createCourse = (content: CourseDoc): Promise<Course> =>
  apiFetch('/courses', {
    method: 'POST',
    body: { title: content.title, content },
  });

export const saveCourse = (id: string, content: CourseDoc): Promise<Course> =>
  apiFetch(`/courses/${id}`, {
    method: 'PUT',
    body: { title: content.title, content },
  });

export const markExported = (id: string): Promise<Course> =>
  apiFetch(`/courses/${id}/exported`, { method: 'POST' });

export const uploadMedia = (id: string, file: File): Promise<{ url: string }> =>
  apiFetch(`/courses/${id}/media?filename=${encodeURIComponent(file.name)}`, {
    method: 'PUT',
    body: file,
  });

export const downloadMedia = (id: string, url: string): Promise<Blob> =>
  apiFetchBlob(`/courses/${id}/media?url=${encodeURIComponent(url)}`);
