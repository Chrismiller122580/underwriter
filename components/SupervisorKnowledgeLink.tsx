'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function SupervisorKnowledgeLink() {
  const [isSupervisor, setIsSupervisor] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => setIsSupervisor(data.authenticated && data.role === 'supervisor'))
      .catch(() => setIsSupervisor(false));
  }, []);

  if (!isSupervisor) return null;

  return (
    <p className="page-intro" style={{ marginTop: 8 }}>
      <Link href="/admin/knowledge">Upload underwriting knowledge</Link> to make
      AI decisions smarter.
    </p>
  );
}