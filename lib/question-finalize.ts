import "server-only";
import { generateLessonImage } from "@/lib/ai/images";
import type { BankedQuestion } from "@/lib/ai/question-bank";

export type FinalizedQuestion = Omit<BankedQuestion, "image"> & {
  imageUrl: string | null;
};

// Resolves AI image prompts to stored URLs in parallel.
// Never throws — questions without a resolved image get imageUrl: null.
export async function finalizeQuestionBank(
  questions: BankedQuestion[],
  topicId: string
): Promise<FinalizedQuestion[]> {
  return Promise.all(
    questions.map(async (q) => {
      const { image, ...rest } = q;
      let imageUrl: string | null = null;
      if (image?.prompt) {
        imageUrl = await generateLessonImage(image.prompt, topicId).catch(() => null);
      }
      return { ...rest, imageUrl };
    })
  );
}
