"use server";

import { getSubject } from "@/lib/supabase/subjects";
import { listTopicsBySubject, listSubtopicsByTopic } from "@/lib/supabase/topics";
import { SubjectDetailCache } from "@/lib/cache/session-store";
import { requireSession } from "@/lib/appwrite/session";

export async function fetchSubjectDetailData(subjectId: string): Promise<SubjectDetailCache | null> {
  await requireSession();

  const subject = await getSubject(subjectId);
  if (!subject) return null;

  const topics = await listTopicsBySubject(subjectId);
  const subtopicsByTopic = await Promise.all(topics.map((t) => listSubtopicsByTopic(t.id)));

  return {
    id: subject.id,
    name: subject.name,
    status: subject.status,
    created_at: subject.created_at,
    custom_instructions: subject.custom_instructions,
    exam_boards: subject.exam_boards,
    topics: topics.map((t, i) => ({
      id: t.id,
      name: t.name,
      summary: t.summary,
      status: t.status,
      custom_instructions: t.custom_instructions,
      subtopics: subtopicsByTopic[i].map((st) => ({
        id: st.id,
        name: st.name,
        status: st.status,
      })),
    })),
  };
}
