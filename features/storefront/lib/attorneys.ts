import { keystoneContext } from '@/features/keystone/context'
import { connection } from 'next/server'

export type PublishedAttorney = {
  slug: string
  name: string
  title: string | null
  focus: string | null
  biography: string | null
  admissions: string[]
  email: string | null
  photoUrl: string | null
  practiceAreas: Array<{ name: string; slug: string | null }>
}

type Row = { slug: string | null; name: string; title: string | null; focus: string | null; biography: string | null; admissions: string | null; email: string | null; photo_id: string | null; photo_extension: string | null; practiceAreas: Array<{ name: string; publicSlug: string | null; isPublic: boolean; status: string }> }

/**
 * Firm-published attorney profiles for the single active firm. Only profiles a
 * firm manager marked public are read; an unpublished firm shows none.
 */
export async function getPublishedAttorneys(firmPublished: boolean, slug?: string): Promise<PublishedAttorney[] | null> {
  await connection()
  if (!firmPublished) return []
  try {
    const firms = await keystoneContext.sudo().prisma.firm.findMany({ where: { status: 'active' }, take: 2, select: { id: true } })
    if (firms.length !== 1) return []
    const rows = await keystoneContext.sudo().prisma.attorneyProfile.findMany({
      where: { firmId: firms[0].id, isPublic: true, ...(slug ? { slug } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 100,
      select: { slug: true, name: true, title: true, focus: true, biography: true, admissions: true, email: true, photo_id: true, photo_extension: true, practiceAreas: { select: { name: true, publicSlug: true, isPublic: true, status: true } } },
    }) as Row[]
    const sign = async (row: Row) => {
      if (!row.photo_id || !row.photo_extension) return null
      try { return await keystoneContext.sudo().images('my_images').getUrl(row.photo_id, row.photo_extension as any) } catch { return null }
    }
    const published = rows.filter((row) => row.slug)
    const photos = await Promise.all(published.map(sign))
    return published.map((row, index) => ({
      photoUrl: photos[index],
      slug: row.slug as string,
      name: row.name,
      title: row.title?.trim() || null,
      focus: row.focus?.trim() || null,
      biography: row.biography?.trim() || null,
      admissions: (row.admissions ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
      email: row.email?.trim() || null,
      practiceAreas: row.practiceAreas.filter((area) => area.isPublic && area.status === 'active').map((area) => ({ name: area.name, slug: area.publicSlug })),
    }))
  } catch {
    return null
  }
}
