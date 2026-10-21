import { CheckCircle2, Quote } from 'lucide-react'

const rules = [
  'Every factual statement must identify an authorized source record and immutable document version.',
  'A citation must preserve the source checksum and a reviewable excerpt or location when extraction exists.',
  'Missing, inaccessible, superseded, or disposed evidence must produce a refusal—not a guessed answer.',
  'Citations are evidence pointers, not a representation that a proposition is current law or legally correct.',
]

export function CitationPolicy() {
  return (
    <section className="border-t border-border pt-4">
      <div className="flex items-start gap-3">
        <Quote className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground">Citation contract</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Model execution remains disabled until these evidence requirements can be enforced and evaluated.
          </p>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {rules.map((rule) => (
          <li key={rule} className="flex min-w-0 items-start gap-3 px-2 py-3 text-sm leading-6 text-foreground">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
