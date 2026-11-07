import { initialsOf } from '@/features/storefront/content'

/** Attorney portrait, shown in black and white (the firm's uploaded photo, desaturated), or initials when none is uploaded. */
export function AttorneyPortrait({ name, photoUrl, size, className }: { name: string; photoUrl: string | null; size: 'card' | 'detail' | 'fill'; className?: string }) {
  const box = className ?? (size === 'detail' ? 'w-28 sm:w-40' : size === 'card' ? 'w-full' : 'w-full')
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={`Portrait of ${name}`} width={400} height={500} className={`${box} aspect-[4/5] shrink-0 object-cover object-[50%_18%] grayscale contrast-[1.06] brightness-[0.94]`} />
  }
  return <span aria-hidden="true" className={`${box} grid aspect-[4/5] shrink-0 place-items-center bg-[var(--sf-tint)] font-[family-name:var(--font-display)] ${size === 'detail' ? 'text-3xl' : 'text-xl'}`}>{initialsOf(name)}</span>
}
