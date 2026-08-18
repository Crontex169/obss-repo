// contracts/interview-flow-rules.md §4.2 sekliyle gecerli adaptif yanit.
export function fakeAdaptive(
  text: string,
  opts: {
    type?: 'multiple_choice' | 'open_ended';
    options?: string[];
    tip?: string | null;
    rationale?: string | null;
    interviewerRemark?: string | null;
  } = {},
) {
  const type = opts.type ?? 'open_ended';
  return {
    evaluationSummary: 'Dahili degerlendirme ozeti.',
    // FR-038: adaya sesli okunan gecis repligi; sema alani zorunlu, deger null
    // olabilir.
    interviewerRemark: opts.interviewerRemark ?? null,
    nextQuestion: {
      type,
      text,
      options: type === 'multiple_choice' ? (opts.options ?? ['A', 'B']) : [],
      // FR-031: sema alanlari zorunlu, deger null olabilir.
      tip: opts.tip ?? null,
      rationale: opts.rationale ?? null,
    },
  };
}
