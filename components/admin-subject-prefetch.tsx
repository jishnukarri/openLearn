"use client";

import { useEffect } from "react";
import { useSubjectCache } from "@/hooks/use-subject-cache";

export function AdminSubjectPrefetch({ subjectIds }: { subjectIds: string[] }) {
  const { prefetchSubjectDetail } = useSubjectCache();

  useEffect(() => {
    // Quietly preload top/recent subjects in background into in-memory store
    for (const id of subjectIds) {
      prefetchSubjectDetail(id);
    }
  }, [subjectIds, prefetchSubjectDetail]);

  return null;
}

