/* Legal research commands. Attaching reads the authority from its official publisher at
 * that moment and stores every paragraph with its official anchor and a hash. Saving a
 * note keeps only citations that name a paragraph retrieved onto the same matter; any
 * other citation is removed and reported back, so a note never shows an unbacked cite. */
import { createHash } from "node:crypto";
import type { Context } from ".keystone/types";

import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentCommandActor } from "./command-authority";
import { assertMatterAccess, recordAuditEvent, requirePermission, workflowActor } from "./workflow-helpers";
import { retrieveLegalSource, searchLegalSources, type LegalSourceProvider } from "../lib/legal-sources/retrieve";
import { noteCitationIds, noteSupport, stripUnknownCitations } from "../lib/legal-sources/parse";

const providers = new Set<LegalSourceProvider>(["maine_statutes", "ecfr", "maine_law_court", "courtlistener"]);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function requireResearchReader(context: Context) {
  const session = context.session as any;
  try {
    return requirePermission(context, "canReadDocuments");
  } catch {
    if (!session) throw new Error("Sign in to search legal sources.");
    return requirePermission(context, "canManageDocuments");
  }
}

export async function searchLegalAuthority(_root: unknown, args: { query: string }, context: Context) {
  requireResearchReader(context);
  return searchLegalSources(String(args.query ?? ""));
}

export async function attachLegalSource(
  _root: unknown,
  args: { matterId: string; provider: string; reference: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  if (!providers.has(args.provider as LegalSourceProvider)) throw new Error("Unsupported legal source.");
  await assertMatterAccess(context.prisma as any, firmId, args.matterId, userId);
  // Network read first, outside the transaction; the write then stores exactly that read.
  const retrieved = await retrieveLegalSource(args.provider as LegalSourceProvider, String(args.reference ?? ""));
  const retrievedAt = new Date();
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, status: true } });
    if (!matter || ["closed", "declined"].includes(matter.status)) throw new Error("Sources can be attached only to an active matter.");
    const existing = await tx.legalSource.findFirst({
      where: { firmId, matterId: matter.id, provider: retrieved.provider, externalId: retrieved.externalId, contentSha256: retrieved.contentSha256 },
      select: { id: true, contentSha256: true },
    });
    const fields = {
      kind: retrieved.kind, jurisdiction: retrieved.jurisdiction, citation: retrieved.citation, title: retrieved.title,
      court: retrieved.court ?? "", decidedOn: retrieved.decidedOn ?? "", sourceAsOf: retrieved.sourceAsOf ?? "", officialUrl: retrieved.officialUrl,
      sourceStatus: retrieved.status, contentSha256: retrieved.contentSha256, paragraphCount: retrieved.paragraphs.length,
      retrievedAt, retrievedById: userId,
    };
    if (existing) return { id: existing.id, status: "unchanged", paragraphCount: retrieved.paragraphs.length, citation: retrieved.citation };
    let sourceId: string;
    {
      const created = await tx.legalSource.create({
        data: { firmId, matterId: matter.id, provider: retrieved.provider, externalId: retrieved.externalId, ...fields },
        select: { id: true },
      });
      sourceId = created.id;
    }
    // Immutable snapshots: never replace the words behind an accepted citation.
    // A changed publisher text creates another source snapshot with its own paragraphs.
    let position = 0;
    for (const paragraph of retrieved.paragraphs) {
      const data = { position, label: paragraph.label, text: paragraph.text, textSha256: sha(paragraph.text) };
      await tx.legalSourceParagraph.create({ data: { firmId, matterId: matter.id, sourceId, anchor: paragraph.anchor, ...data } });
      position += 1;
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: "legal_source.attached",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: matter.id,
      metadata: {
        sourceId, provider: retrieved.provider, citation: retrieved.citation, officialUrl: retrieved.officialUrl,
        contentSha256: retrieved.contentSha256, paragraphs: retrieved.paragraphs.length,
      },
    });
    return { id: sourceId, status: "attached", paragraphCount: retrieved.paragraphs.length, citation: retrieved.citation };
  });
}

export async function saveResearchNote(
  _root: unknown,
  args: { matterId: string; noteId?: string | null; title: string; body: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const title = String(args.title ?? "").trim();
  if (title.length < 3 || title.length > 200) throw new Error("Title must be 3–200 characters.");
  const raw = String(args.body ?? "").replace(/\r/g, "");
  if (raw.trim().length < 10 || raw.length > 40_000) throw new Error("Write the note (10–40,000 characters).");
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    const requested = noteCitationIds(raw);
    const found = requested.length
      ? await tx.legalSourceParagraph.findMany({ where: { firmId, matterId: args.matterId, id: { in: requested } }, select: { id: true } })
      : [];
    const known = new Set<string>(found.map((row: any) => row.id));
    const { body, removed } = stripUnknownCitations(raw, known);
    const support = noteSupport(body);
    const cited = [...known].map((id) => ({ id }));
    let id: string;
    let revision = 1;
    if (args.noteId) {
      const note = await tx.researchNote.findFirst({ where: { id: args.noteId, firmId, matterId: args.matterId }, select: { id: true, revision: true } });
      if (!note) throw new Error("That research note is not on this matter.");
      revision = note.revision + 1;
      await tx.researchNote.update({
        where: { id: note.id },
        data: { title, body, claimCount: support.claims, supportedCount: support.supported, revision, removedCitations: removed, citedParagraphs: { set: cited } },
      });
      id = note.id;
    } else {
      const note = await tx.researchNote.create({
        data: { firmId, matterId: args.matterId, title, body, authorId: userId, claimCount: support.claims, supportedCount: support.supported, revision, removedCitations: removed, citedParagraphs: { connect: cited } },
        select: { id: true },
      });
      id = note.id;
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: args.noteId ? "research_note.revised" : "research_note.created",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: args.matterId,
      metadata: { noteId: id, revision, citations: known.size, removedCitations: removed, claims: support.claims, supported: support.supported, bodySha256: sha(body) },
    });
    return { id, revision, claimCount: support.claims, supportedCount: support.supported, removedCitations: removed };
  });
}
