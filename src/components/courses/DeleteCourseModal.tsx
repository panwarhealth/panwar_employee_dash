import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCourse, type CourseSummary } from "@/api/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function DeleteCourseModal({
  course,
  onClose,
}: {
  course: CourseSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");
  const [exportedOk, setExportedOk] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteCourse(course.id, typed.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      onClose();
    },
  });

  const ready =
    typed.trim() === course.title &&
    (!course.lastExportedAt || exportedOk) &&
    !remove.isPending;

  return (
    <Modal open onClose={onClose} title="Delete course" className="max-w-lg">
      <div className="space-y-4 px-6 py-5 text-sm text-ph-charcoal">
        <p>
          This deletes <strong>{course.title}</strong> and every page in it. It
          can't be undone.
        </p>
        {course.lastExportedAt && (
          <label className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-red-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={exportedOk}
              onChange={(e) => setExportedOk(e.target.checked)}
            />
            <span>
              This course has been exported. I understand the editable version
              will be gone, and only the zip copies will be left.
            </span>
          </label>
        )}
        <div>
          <p className="mb-1.5">Type the course title to confirm:</p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={course.title}
            aria-label="Course title"
            autoFocus
          />
        </div>
        {remove.error && <p className="text-red-700">{remove.error.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Deleting…" : "Delete forever"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
