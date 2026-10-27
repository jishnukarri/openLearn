"use client";

import { useEffect, useState, useCallback } from "react";
import { subjectStore, SubjectItem, SubjectDetailCache } from "@/lib/cache/session-store";
import { fetchSubjectDetailData } from "@/app/actions/subject-cache-actions";

export function useSubjectCache(initialSubjects?: SubjectItem[]) {
  const [cleared, setCleared] = useState(false);
  const subjects = cleared ? [] : subjectStore.getSubjects() || initialSubjects || [];

  useEffect(() => {
    if (initialSubjects && !subjectStore.getSubjects()) {
      subjectStore.setSubjects(initialSubjects);
    }
  }, [initialSubjects]);

  const prefetchSubjectDetail = useCallback(async (subjectId: string) => {
    if (subjectStore.getSubjectDetail(subjectId)) return;
    try {
      const data = await fetchSubjectDetailData(subjectId);
      if (data) {
        subjectStore.setSubjectDetail(subjectId, data);
      }
    } catch (e) {
      console.error("Failed to prefetch subject detail:", e);
    }
  }, []);

  const getSubjectDetailLazy = useCallback(
    async (subjectId: string): Promise<SubjectDetailCache | null> => {
      const cached = subjectStore.getSubjectDetail(subjectId);
      if (cached) return cached;

      const fetched = await fetchSubjectDetailData(subjectId);
      if (fetched) {
        subjectStore.setSubjectDetail(subjectId, fetched);
      }
      return fetched;
    },
    []
  );

  const invalidateSubject = useCallback((subjectId: string) => {
    subjectStore.invalidateSubject(subjectId);
  }, []);

  const clearAllCache = useCallback(() => {
    subjectStore.clear();
    setCleared(true);
  }, []);

  return {
    subjects,
    prefetchSubjectDetail,
    getSubjectDetailLazy,
    invalidateSubject,
    clearAllCache,
  };
}
