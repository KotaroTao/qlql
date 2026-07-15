import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDiagnosisType } from "@/data/diagnosis-types";
import { DiagnosisFlow } from "@/components/diagnosis/diagnosis-flow";

interface Props {
  params: Promise<{ type: string }>;
}

async function getDiagnosis(slug: string) {
  // まずデータベースから取得を試みる
  try {
    const dbDiagnosis = await prisma.diagnosisType.findUnique({
      where: { slug, isActive: true },
    });

    if (dbDiagnosis) {
      // DBの診断データをDiagnosisFlow用の形式に変換
      // DBは options で保存、DiagnosisFlow は choices を期待
      const rawQuestions = dbDiagnosis.questions as Array<{
        id: number | string;
        text: string;
        imageUrl?: string | null;
        options?: Array<{ text: string; score: number }>;
        choices?: Array<{ text: string; score: number }>;
      }>;

      const questions = rawQuestions.map((q, index) => ({
        id: typeof q.id === 'number' ? q.id : index + 1,
        text: q.text,
        imageUrl: q.imageUrl || null,
        choices: q.choices || q.options || [],
      }));

      const rawResultPatterns = dbDiagnosis.resultPatterns as Array<{
        minScore: number;
        maxScore: number;
        category: string;
        title: string;
        message?: string;
        description?: string;
        advice?: string;
        ageModifier?: number;
      }>;

      const resultPatterns = rawResultPatterns.map((p) => ({
        minScore: p.minScore,
        maxScore: p.maxScore,
        category: p.category,
        title: p.title,
        message: p.message || p.description || p.advice || "",
        ageModifier: p.ageModifier,
      }));

      return {
        slug: dbDiagnosis.slug,
        name: dbDiagnosis.name,
        description: dbDiagnosis.description || "",
        questions,
        resultPatterns,
      };
    }
  } catch (error) {
    console.error("Failed to fetch diagnosis from DB:", error);
  }

  // DBになければハードコードされたデータを使用（フォールバック）
  return getDiagnosisType(slug);
}

export default async function DemoDiagnosisPage({ params }: Props) {
  const { type } = await params;
  const diagnosis = await getDiagnosis(type);

  if (!diagnosis) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <DiagnosisFlow diagnosis={diagnosis} isDemo={true} />
    </main>
  );
}

export async function generateStaticParams() {
  return [
    { type: "oral-age" },
    { type: "child-orthodontics" },
    { type: "periodontal-risk" },
    { type: "cavity-risk" },
    { type: "whitening-check" },
    { type: "teeth-yellowing" },
    { type: "visit-timing" },
    { type: "bad-breath-risk" },
    { type: "bruxism-risk" },
    { type: "denture-risk" },
    { type: "adult-alignment" },
    { type: "child-alignment" },
  ];
}

export const dynamic = "force-dynamic";
