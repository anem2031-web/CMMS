import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { useTranslation } from "@/contexts/LanguageContext";

export default function AIAssistant() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const askMut = trpc.ai.analyze.useMutation({
    onSuccess: (data) => { setResponse(typeof data.answer === 'string' ? data.answer : JSON.stringify(data.answer)); setIsLoading(false); },
    onError: (err: { message: string }) => { setResponse(`${err.message}`); setIsLoading(false); },
  });

  const handleAsk = () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResponse("");
    askMut.mutate({ question: query });
  };

  const suggestions = [
    "ما هي أكثر أنواع الأعطال تكراراً هذا الشهر؟",
    "اقترح خطة صيانة وقائية بناءً على البيانات الحالية",
    "ما هو متوسط وقت إغلاق البلاغات؟",
    "ملخص أداء فريق الصيانة هذا الأسبوع",
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" /> {t.nav.aiAssistant}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.nav.aiAssistant}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <Button key={i} variant="outline" size="sm" className="text-xs h-auto py-1.5 px-3" onClick={() => { setQuery(s); }}>
            <Sparkles className="w-3 h-3 ml-1" /> {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={3}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
          />
          <Button onClick={handleAsk} disabled={isLoading || !query.trim()} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t.common.submit}
          </Button>
        </CardContent>
      </Card>

      {(response || isLoading) && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4" /> {t.common.details}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t.common.loading}</span>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{response}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
