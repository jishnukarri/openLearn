// In-memory tab-scoped store for subjects and subject details.
// Cleared automatically on tab close / unload or logout.

export type SubjectItem = {
  id: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  exam_boards: { id: string; name: string }[];
  topicCount: number;
};

export type SubjectDetailCache = {
  id: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  custom_instructions: string | null;
  exam_boards: { id: string; name: string }[];
  topics: {
    id: string;
    name: string;
    summary: string | null;
    status: "draft" | "published";
    custom_instructions: string | null;
    subtopics: {
      id: string;
      name: string;
      status: "draft" | "published";
    }[];
  }[];
};

class SubjectMemoryStore {
  private subjects: SubjectItem[] | null = null;
  private subjectDetails: Map<string, { data: SubjectDetailCache; timestamp: number }> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.clear();
      });
      window.addEventListener("unload", () => {
        this.clear();
      });
    }
  }

  public setSubjects(list: SubjectItem[]) {
    this.subjects = list;
  }

  public getSubjects(): SubjectItem[] | null {
    return this.subjects;
  }

  public setSubjectDetail(id: string, detail: SubjectDetailCache) {
    this.subjectDetails.set(id, { data: detail, timestamp: Date.now() });
  }

  public getSubjectDetail(id: string): SubjectDetailCache | null {
    const entry = this.subjectDetails.get(id);
    if (!entry) return null;
    return entry.data;
  }

  public invalidateSubject(id: string) {
    this.subjectDetails.delete(id);
  }

  public clear() {
    this.subjects = null;
    this.subjectDetails.clear();
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("open_learn_subject_cache");
      } catch {}
    }
  }
}

export const subjectStore = new SubjectMemoryStore();
