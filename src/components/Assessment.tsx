import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { api, idOf, titleOf, questionCount } from "@/lib/api";
import { assessmentChildren, assessmentDiagnostics, assessmentQuestionCount, assessmentQuestionSource, assessmentShareLink, questionList, questionPath, type Question } from "@/lib/assessment";
import { ErrorBox, Loading } from "./AppShell";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function Assessment({ item, kind, onClose }: { item: any; kind: "test" | "qbank"; onClose: () => void }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>{titleOf(item)}</DialogTitle></DialogHeader>
      <AssessmentContent item={item} kind={kind} />
    </DialogContent>
  </Dialog>;
}

function AssessmentContent({ item, kind }: { item: any; kind: "test" | "qbank" }) {
  const [selected, setSelected] = useState<any>();
  const [trail, setTrail] = useState<any[]>([]);
  const current = selected ?? item;
  const path = questionPath(current);
  const q = useQuery({
    queryKey: ["assessment", kind, idOf(current), path],
    queryFn: async () => {
      if (path) return api(path);
      const catalog = await api(kind === "test" ? "/test" : "/qbank/subjects");
      const source = assessmentQuestionSource(catalog, idOf(current) ?? "", current);
      return source.path ? api(source.path) : source.entity;
    },
    retry: 1,
  });
  const questions = questionList(q.data ?? current);
  const children = assessmentChildren(q.data ?? current);
  const shareLink = assessmentShareLink(q.data) ?? assessmentShareLink(current);
  const reportedQuestionCount = assessmentQuestionCount(q.data) ?? assessmentQuestionCount(current);
  return <div className="space-y-4">
    {selected && <Button variant="ghost" onClick={() => {
      setSelected(trail.at(-1)); setTrail(trail.slice(0, -1));
    }}><ArrowLeft /> Back</Button>}
    {selected && <h2 className="text-lg font-semibold">{titleOf(current)}</h2>}
    {q.isLoading ? <Loading /> : q.error ? <><ErrorBox error={q.error} /><Button variant="outline" onClick={() => q.refetch()}><RotateCcw />Try again</Button></>
      : questions.length ? <QuestionRunner key={`${kind}-${idOf(current)}`} questions={questions} />
      : children.length ? <div className="grid gap-2">
        {children.map((child, i) => <Button key={idOf(child) ?? i} variant="outline" className="h-auto justify-between whitespace-normal py-3 text-left" onClick={() => {
          setTrail([...trail, selected]); setSelected(child);
        }}><span className="min-w-0"><span className="block break-words">{titleOf(child)}</span>{questionCount(child) != null && <span className="mt-1 block text-xs text-muted-foreground">{questionCount(child)} MCQs{child.completed_count != null ? ` · ${child.completed_count} completed` : ""}</span>}</span><ArrowRight className="shrink-0" /></Button>)}
      </div> : <div role="status" className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">{reportedQuestionCount != null
          ? `NPrep reports ${reportedQuestionCount} questions but returned no question data or question endpoint for this ${kind === "test" ? "test" : "subject"}.`
          : `NPrep returned this ${kind === "test" ? "test" : "subject"}, but no questions or question endpoint.`} Question taking can start when question data or an API question link is available.</p>
        {shareLink && <a href={shareLink} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-primary underline underline-offset-4">Open NPrep share link</a>}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">NPrep response shape (field names only)</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">{assessmentDiagnostics({ selected: current, fetched: q.data })}</pre>
        </details>
        <Button variant="outline" onClick={() => q.refetch()}><RotateCcw />Retry</Button>
      </div>}
  </div>;
}

function QuestionRunner({ questions }: { questions: Question[] }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const question = questions[index];
  if (!question) return null;
  const answered = Object.keys(answers).length;
  const gradable = questions.filter((q) => q.correctId != null);
  const correct = gradable.filter((q) => answers[q.id] === q.correctId).length;
  if (finished) return <div className="space-y-4">
    <h2 className="text-xl font-semibold">Attempt summary</h2>
    <p>{answered} answered · {questions.length - answered} unanswered</p>
    {gradable.length > 0 && <p>{correct} correct out of {gradable.length} questions with an answer key</p>}
    <p className="text-sm text-muted-foreground">This attempt has not been saved to your NPrep account. No answer-submission connection was provided.</p>
    {questions.map((q, i) => <section key={q.id} className="space-y-2 border-t border-border pt-4">
      <h3 className="font-medium">{i + 1}. {q.text}</h3>
      <p className="text-sm">Your answer: {q.options.find((o) => o.id === answers[q.id])?.text ?? "Unanswered"}</p>
      {q.correctId != null && <p className="text-sm text-primary">Correct answer: {q.options.find((o) => o.id === q.correctId)?.text ?? "Not available"}</p>}
      {q.explanation && <p className="text-sm text-muted-foreground">{q.explanation}</p>}
    </section>)}
    <Button variant="outline" onClick={() => { setFinished(false); setConfirm(false); }}>Review answers</Button>
  </div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>Question {index + 1} of {questions.length}</span><span>{answered} answered</span></div>
    <h2 className="break-words text-lg font-semibold">{question.text}</h2>
    <fieldset className="space-y-2"><legend className="sr-only">Choose an answer</legend>
      {question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent">
        <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} className="mt-1 accent-primary" />
        <span className="break-words">{option.text}</span>
      </label>)}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setAnswers((old) => { const next = { ...old }; delete next[question.id]; return next; })}>Clear answer</Button>
      <Button variant={flagged.has(question.id) ? "secondary" : "outline"} aria-pressed={flagged.has(question.id)} onClick={() => setFlagged((old) => { const next = new Set(old); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; })}>Mark for review</Button>
    </div>
    <nav aria-label="Questions" className="flex flex-wrap gap-2">{questions.map((q, i) => <Button key={q.id} size="icon" variant={i === index ? "default" : answers[q.id] ? "secondary" : "outline"} aria-label={`Question ${i + 1}${flagged.has(q.id) ? ", marked for review" : ""}`} onClick={() => setIndex(i)}>{i + 1}{flagged.has(q.id) ? "*" : ""}</Button>)}</nav>
    <div className="flex flex-wrap justify-between gap-2">
      <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft />Previous</Button>
      {index < questions.length - 1 && <Button onClick={() => setIndex(index + 1)}>Next<ArrowRight /></Button>}
      <Button variant="secondary" onClick={() => setConfirm(true)}>Finish attempt</Button>
    </div>
    {confirm && <div className="space-y-3 border-t border-border pt-4"><p>{questions.length - answered} questions unanswered. Finish this attempt?</p><p className="text-sm text-muted-foreground">Results remain on this screen and are not saved to NPrep.</p><div className="flex gap-2"><Button onClick={() => setFinished(true)}>Finish</Button><Button variant="outline" onClick={() => setConfirm(false)}>Continue answering</Button></div></div>}
  </div>;
}