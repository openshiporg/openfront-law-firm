import { initialsOf } from '@/features/storefront/content'

/** Attorney portrait (4:5, ruled border) or the initials avatar when no portrait is uploaded. */
export function AttorneyPortrait({ name, photoUrl, size }: { name: string; photoUrl: string | null; size: 'card' | 'detail' }) {
  const box = size === 'detail' ? 'w-24 sm:w-28' : 'w-20'
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={`Portrait of ${name}`} width={400} height={500} loading="lazy" className={`${box} aspect-[4/5] shrink-0 rounded-[2px] border border-[var(--pad-rule-strong)] object-cover`} />
  }
  return <span aria-hidden="true" className={`${box} grid aspect-[4/5] shrink-0 place-items-center rounded-[2px] bg-[var(--sf-tint)] font-[family-name:var(--font-display)] ${size === 'detail' ? 'text-3xl' : 'text-xl'}`}>{initialsOf(name)}</span>
}
