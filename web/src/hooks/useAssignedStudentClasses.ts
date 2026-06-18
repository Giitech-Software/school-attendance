import { useEffect, useMemo, useState } from "react";
import { listClasses, type ClassRecord } from "../services/classes";

function isAssignedToClass(cls: ClassRecord, uid?: string | null) {
  if (!uid) return false;
  return cls.teacherId === uid || (Array.isArray(cls.assignedStaffUids) && cls.assignedStaffUids.includes(uid));
}

export function useAssignedStudentClasses(uid?: string | null) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    let active = true;

    if (!uid) {
      setClasses([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const allClasses = await listClasses();
        if (active) setClasses(allClasses.filter((cls) => isAssignedToClass(cls, uid)));
      } catch (err) {
        console.error("useAssignedStudentClasses", err);
        if (active) setClasses([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
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
