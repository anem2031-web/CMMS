import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";

export function ImprovementReference({ kind, documentId }: { kind: "ticket" | "purchase"; documentId: number }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const reference = trpc.improvementIdeas.executionReference.useQuery({ kind, id: documentId }, { enabled: documentId > 0, retry: false });
  if (reference.isError) return <p className="text-sm text-destructive">{reference.error.message}</p>;
  if (!reference.data) return null;
  return <Card><CardContent className="p-3 flex items-center gap-3 flex-wrap">
    <span>{t.improvementIdeas.pageTitle}: <span className="font-mono">{reference.data.requestNumber}</span></span>
    <Button variant="link" onClick={() => navigate(`/improvement-ideas?ideaId=${reference.data!.id}`)}>{t.improvementIdeas.goToLinked}</Button>
  </CardContent></Card>;
}
