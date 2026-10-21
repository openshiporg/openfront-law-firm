import { activeFirmId } from "../access";
import { relationshipConnectionIds } from "../tenancy";

export type MatterTeamCapability = "canEdit" | "canBill";

/** The matters a generated write touches: the Matter itself, or a record's current
 * matter plus any matter it is being moved to. */
function touchedMatterIds(args: any) {
  const ids = new Set<string>();
  if (args.listKey === "Matter") {
    if (args.item?.id) ids.add(String(args.item.id));
    return ids;
  }
  if (args.item?.matterId) ids.add(String(args.item.matterId));
  for (const id of relationshipConnectionIds(args.resolvedData?.matter)) ids.add(id);
  return ids;
}

/** Generated CRUD must honour the same explicit per-matter team authority as the
 * lifecycle commands (assertMatterTeamCapability): reading a matter or holding a
 * firm billing role is not permission to edit or bill it. Matter creation is not
 * checked, since a new matter has no team until it is staffed. */
export async function validateMatterTeamCapability(args: any, capability: MatterTeamCapability) {
  if (args.listKey === "Matter" && args.operation !== "update") return;
  const userId = args.context.session?.itemId;
  const firmId = activeFirmId(args.context.session as never);
  if (!userId || !firmId) return;
  const matterIds = [...touchedMatterIds(args)];
  if (!matterIds.length) return;
  const granted = await args.context.prisma.matterTeamMember.count({
    where: { firmId, userId, status: "active", [capability]: true, matterId: { in: matterIds } },
  });
  if (granted !== matterIds.length) {
    args.addValidationError(capability === "canBill"
      ? "Matter billing authority is not explicitly granted to this team member."
      : "Matter editing authority is not explicitly granted to this team member.");
  }
}
