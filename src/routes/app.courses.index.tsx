import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { listCourses, type CourseSummary } from "@/api/courses";
import { DeleteCourseModal } from "@/components/courses/DeleteCourseModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtAgo, fmtDate } from "@/lib/edm";

export const Route = createFileRoute("/app/courses/")({
  component: CoursesPage,
});

function CoursesPage() {
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<CourseSummary | null>(null);
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
  });

  const needle = query.trim().toLowerCase();
  const rows = courses.filter(
    (c) => !needle || c.title.toLowerCase().includes(needle),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-8 sm:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ph-purple">
          Course editor
        </p>
        <h1 className="text-2xl font-bold leading-tight text-ph-charcoal">
          Which course are you working on?
        </h1>
        <p className="mb-6 mt-1 text-ph-charcoal/60">
          Courses built here export as a SCORM zip. Upload it to Clinical
          Studio, or any LMS that plays SCORM 1.2.
        </p>

        <Input
          className="mb-2 h-11 text-base"
          placeholder="Search courses"
          aria-label="Search courses"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {isLoading ? (
          <p className="py-8 text-sm text-ph-charcoal/60">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-sm text-ph-charcoal/60">
            {courses.length === 0
              ? "No courses yet. Start one with New course."
              : "Nothing matches that search."}
          </p>
        ) : (
          <ul className="divide-y divide-ph-charcoal/10">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ph-charcoal">
                      {c.title}
                    </span>
                    <span className="rounded-full bg-ph-purple/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ph-purple">
                      {c.lastExportedAt ? "Exported" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ph-charcoal/60">
                    Edited {fmtAgo(c.updatedAt)}
                    {c.updatedByName ? ` by ${c.updatedByName}` : ""} ·{" "}
                    {c.lastExportedAt
                      ? `zip exported ${fmtDate(c.lastExportedAt)}`
                      : "not exported yet"}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/app/courses/$courseId" params={{ courseId: c.id }}>
                    Open
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${c.title}`}
                  title="Delete course"
                  className="text-ph-charcoal/40 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setDeleting(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <Button size="lg" asChild>
            <Link to="/app/courses/new">New course</Link>
          </Button>
        </div>
      </Card>
      {deleting && (
        <DeleteCourseModal
          course={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
