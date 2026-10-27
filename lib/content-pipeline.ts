import "server-only";
import { getTopic } from "@/lib/supabase/topics";
import { getLessonByTopic, createLesson } from "@/lib/supabase/lessons";
import { listQuestionBankForTopic, createQuestionBank } from "@/lib/supabase/questions";
import { getFlashcardsByTopic, createFlashcardSet } from "@/lib/supabase/flashcards";
import { generateLesson } from "@/lib/ai/lessons";
import { generateQuestionBank } from "@/lib/ai/question-bank";
import { generateFlashcards } from "@/lib/ai/flashcards";
import { finalizeQuestionBank } from "@/lib/question-finalize";
import { resolveProviderConfig } from "@/lib/ai/client";
import { finalizeLessonContent } from "@/lib/lesson-finalize";
import { withReferenceContext } from "@/lib/rag";

export async function pregenerateTopicContent(
  topicId: string,
  requestedBy?: string | null
): Promise<void> {
  const topic = await getTopic(topicId);
  if (!topic) return;

  const config = await resolveProviderConfig(requestedBy);
  const instructions = await withReferenceContext(
    topicId,
    topic.name,
    topic.custom_instructions
  );
  let lesson = await getLessonByTopic(topicId);
  const existingBank = await listQuestionBankForTopic(topicId);

  if (!lesson) {
    const rawContent = await generateLesson(topic.name, topic.subject.name, false, instructions, config);
    const finalized = await finalizeLessonContent(rawContent, topicId, topic.subject.name);
    await createLesson(topicId, finalized);
    lesson = finalized;
  }

  if (existingBank.length === 0 && lesson) {
    const sections = (lesson.sections || []).map((s: { heading: string; explanation: string }) => ({
      heading: s.heading,
      explanation: s.explanation,
    }));

    const rawBank = await generateQuestionBank(
      topic.name,
      topic.subject.name,
      sections,
      instructions,
      config
    );

    const bankItems = await finalizeQuestionBank(rawBank, topicId);
    await createQuestionBank(topicId, bankItems);
  }

  const existingFlashcards = await getFlashcardsByTopic(topicId);
  if (!existingFlashcards) {
    const flashcards = await generateFlashcards(
      topic.name,
      topic.subject.name,
      instructions,
      config
    );
    await createFlashcardSet(topicId, flashcards);
  }
}
