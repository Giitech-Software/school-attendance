import { useEffect, useMemo, useState } from "react";
import type { ClassRecord } from "../services/classes";
import { listClasses } from "../services/classes";

function isAssignedToClass(cls: ClassRecord, uid?: string | null) {
  if (!uid) return false;

  return (
    cls.teacherId === uid ||
    (Array.isArray(cls.assignedStaffUids) &&
      cls.assignedStaffUids.includes(uid))
  );
}

export function useAssignedStudentClasses(uid?: string | null) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    let mounted = true;

    if (!uid) {
      setClasses([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const allClasses = await listClasses();
        if (!mounted) return;
        setClasses(allClasses.filter((cls) => isAssignedToClass(cls, uid)));
      } catch (error) {
        console.error("useAssignedStudentClasses", error);
        if (mounted) setClasses([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [uid]);

  const classKeys = useMemo(() => {
    const keys = new Set<string>();
    classes.forEach((cls) => {
      if (cls.id) keys.add(cls.id);
      if (cls.classId) keys.add(cls.classId);
    });
    return keys;
  }, [classes]);

  return {
    classes,
    classKeys,
    hasAssignedClasses: classes.length > 0,
    loading,
  };
}
