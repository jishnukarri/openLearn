import "server-only";
import { createServiceClient } from "./server";
import type { SubjectSummary } from "./subjects";

// Published subjects authored by an admin — the only copy source, per this
// feature's scope (copying other teachers' subjects is explicitly out).
export async function listPublishedAdminSubjects(): Promise<SubjectSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, status, created_at, created_by, subject_exam_boards(exam_boards(id, name)), topics(id), profiles!subjects_created_by_fkey(role)"
    )
    .eq("status", "published")
    .order("name");
  if (error) throw error;
  return (data as any[])
    .filter((d) => d.profiles?.role === "admin")
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      created_at: d.created_at,
      created_by: d.created_by,
      exam_boards: d.subject_exam_boards.flatMap((row: any) => row.exam_boards),
      topicCount: (d.topics as any[]).length,
    }));
}

// Copies subjectId's full tree (subject, exam-board links, topics,
// subtopics, shared lessons/questions/flashcards) into a brand-new, fully
// independent subject owned by teacherId. Returns the new subject's id.
export async function copySubjectForTeacher(
  subjectId: string,
  teacherId: string
): Promise<string> {
  const supabase = createServiceClient();

  const { data: source, error: sourceError } = await supabase
    .from("subjects")
    .select(
      "name, custom_instructions, archetype, subject_exam_boards(exam_board_id, spec_text, spec_url, status)"
    )
    .eq("id", subjectId)
    .single();
  if (sourceError) throw sourceError;

  const { data: newSubject, error: subjectError } = await supabase
    .from("subjects")
    .insert({
      name: source.name,
      custom_instructions: source.custom_instructions,
      archetype: source.archetype,
      created_by: teacherId,
      status: "draft",
    })
    .select("id")
    .single();
  if (subjectError) throw subjectError;
  const newSubjectId: string = newSubject.id;

  const boardLinks = (source.subject_exam_boards as any[]) ?? [];
  if (boardLinks.length > 0) {
    const { error } = await supabase.from("subject_exam_boards").insert(
      boardLinks.map((b) => ({
        subject_id: newSubjectId,
        exam_board_id: b.exam_board_id,
        spec_text: b.spec_text,
        spec_url: b.spec_url,
        status: b.status,
      }))
    );
    if (error) throw error;
  }

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, name, summary, position, status, custom_instructions, exam_board_id")
    .eq("subject_id", subjectId);
  if (topicsError) throw topicsError;
  if (!topics || topics.length === 0) return newSubjectId;

  const { data: newTopics, error: newTopicsError } = await supabase
    .from("topics")
    .insert(
      topics.map((t) => ({
        subject_id: newSubjectId,
        name: t.name,
        summary: t.summary,
        position: t.position,
        status: t.status,
        custom_instructions: t.custom_instructions,
        exam_board_id: t.exam_board_id,
      }))
    )
    .select("id");
  if (newTopicsError) throw newTopicsError;

  const topicIdMap = new Map<string, string>(topics.map((t, i) => [t.id, newTopics[i].id]));
  const sourceTopicIds = topics.map((t) => t.id);

  const { data: subtopics, error: subtopicsError } = await supabase
    .from("subtopics")
    .select("id, topic_id, name, position, status")
    .in("topic_id", sourceTopicIds);
  if (subtopicsError) throw subtopicsError;

  let subtopicIdMap = new Map<string, string>();
  if (subtopics && subtopics.length > 0) {
    const { data: newSubtopics, error: newSubtopicsError } = await supabase
      .from("subtopics")
      .insert(
        subtopics.map((s) => ({
          topic_id: topicIdMap.get(s.topic_id),
          name: s.name,
          position: s.position,
          status: s.status,
        }))
      )
      .select("id");
    if (newSubtopicsError) throw newSubtopicsError;
    subtopicIdMap = new Map(subtopics.map((s, i) => [s.id, newSubtopics[i].id]));
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("topic_id, subtopic_id, content")
    .in("topic_id", sourceTopicIds)
    .is("class_id", null);
  if (lessonsError) throw lessonsError;
  if (lessons && lessons.length > 0) {
    const { error } = await supabase.from("lessons").insert(
      lessons.map((l) => ({
        topic_id: topicIdMap.get(l.topic_id),
        subtopic_id: l.subtopic_id ? subtopicIdMap.get(l.subtopic_id) : null,
        content: l.content,
      }))
    );
    if (error) throw error;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "topic_id, subtopic_id, prompt, markscheme, max_marks, model_answer, format, section_index, bank_position, verified, image_url"
    )
    .in("topic_id", sourceTopicIds)
    .is("class_id", null);
  if (questionsError) throw questionsError;
  if (questions && questions.length > 0) {
    const { error } = await supabase.from("questions").insert(
      questions.map((q) => ({
        topic_id: topicIdMap.get(q.topic_id),
        subtopic_id: q.subtopic_id ? subtopicIdMap.get(q.subtopic_id) : null,
        prompt: q.prompt,
        markscheme: q.markscheme,
        max_marks: q.max_marks,
        model_answer: q.model_answer,
        format: q.format,
        section_index: q.section_index,
        bank_position: q.bank_position,
        verified: q.verified,
        image_url: q.image_url,
      }))
    );
    if (error) throw error;
  }

  const { data: flashcardSets, error: flashcardsError } = await supabase
    .from("flashcard_sets")
    .select("topic_id, subtopic_id, cards")
    .in("topic_id", sourceTopicIds);
  if (flashcardsError) throw flashcardsError;
  if (flashcardSets && flashcardSets.length > 0) {
    const { error } = await supabase.from("flashcard_sets").insert(
      flashcardSets.map((f) => ({
        topic_id: topicIdMap.get(f.topic_id),
        subtopic_id: f.subtopic_id ? subtopicIdMap.get(f.subtopic_id) : null,
        cards: f.cards,
      }))
    );
    if (error) throw error;
  }

  return newSubjectId;
}
