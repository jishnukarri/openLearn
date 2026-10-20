import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getPiece } from "@/lib/onboarding-pieces";
import { markPieceCompleteAction } from "@/app/actions/onboarding";
import { LessonsTour } from "@/components/guide-tours/lessons-tour";
import { PracticeTour } from "@/components/guide-tours/practice-tour";
import { XpTour } from "@/components/guide-tours/xp-tour";

export default async function GuidePage({ params }: { params: Promise<{ piece: string }> }) {
  await requireRole("student");
  const { piece } = await params;
  if (!getPiece(piece)) notFound();

  if (piece === "how-lessons-work") return <LessonsTour completeAction={markPieceCompleteAction} />;
  if (piece === "how-practice-works") return <PracticeTour completeAction={markPieceCompleteAction} />;
  if (piece === "how-xp-works") return <XpTour completeAction={markPieceCompleteAction} />;
  notFound();
}
