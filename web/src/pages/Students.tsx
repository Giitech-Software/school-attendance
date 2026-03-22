// web/src/pages/Students.tsx
import { useEffect, useState } from 'react';
import { listStudents } from '../services/students'; // adjust path
import type { Student } from '../types';

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  useEffect(()=>{ listStudents().then(setStudents).catch(e=>alert(e.message)); },[]);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Students</h1>
      <div className="space-y-2">
        {students.map(s=> (
          <div key={s.id} className="p-4 border rounded">{s.name} <div className="text-sm text-neutral">{s.classId}</div></div>
        ))}
      </div>
    </div>
  );
}
