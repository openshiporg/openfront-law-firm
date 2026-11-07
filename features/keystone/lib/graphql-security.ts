import { maskError } from "graphql-yoga";
import {
  getNamedType,
  GraphQLError,
  isCompositeType,
  isListType,
  isNonNullType,
  Kind,
  NoSchemaIntrospectionCustomRule,
  type ExecutionResult,
  type FragmentDefinitionNode,
  type GraphQLCompositeType,
  type GraphQLOutputType,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from "graphql";
import type { Plugin } from "graphql-yoga";

export const MAX_GRAPHQL_BODY_BYTES = 1_000_000;
export const MAX_GRAPHQL_UPLOAD_BYTES = 10_000_000;
export const MAX_GRAPHQL_UPLOAD_FILES = 5;
export const MAX_GRAPHQL_EXPANDED_SELECTIONS = 10_000;

export const graphqlDepthOptions = Object.freeze({
  maxDepth: 12,
  maxListDepth: 4,
  maxSelfReferentialDepth: 2,
});

type DepthState = {
  depth: number;
  listDepth: number;
  references: ReadonlyMap<string, number>;
};

function listNesting(type: GraphQLOutputType): number {
  if (isNonNullType(type)) return listNesting(type.ofType);
  return isListType(type) ? 1 + listNesting(type.ofType) : 0;
}

function operationRoot(context: ValidationContext, operation: OperationDefinitionNode) {
  const schema = context.getSchema();
  if (operation.operation === "mutation") return schema.getMutationType();
  if (operation.operation === "subscription") return schema.getSubscriptionType();
  return schema.getQueryType();
}

function selectionExceedsDepth(
  context: ValidationContext,
  selectionSet: SelectionSetNode,
  parentType: GraphQLCompositeType,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  state: DepthState,
  activeFragments: ReadonlySet<string>,
  budget: { remaining: number },
): boolean {
  for (const selection of selectionSet.selections) {
    // Bound fragment DAG expansion as well as field depth. Acyclic repeated
    // fragments otherwise expand exponentially without increasing field depth.
    if (budget.remaining-- <= 0) return true;
    if (selection.kind === Kind.FIELD) {
      const fields = "getFields" in parentType ? parentType.getFields() : {};
      const field = fields[selection.name.value];
      if (!field) continue;
      const depth = state.depth + 1;
      const listDepth = state.listDepth + listNesting(field.type);
      const referenceKey = `${parentType.name}.${selection.name.value}`;
      const referenceCount = (state.references.get(referenceKey) ?? 0) + 1;
      if (
        depth > graphqlDepthOptions.maxDepth ||
        listDepth > graphqlDepthOptions.maxListDepth ||
        referenceCount > graphqlDepthOptions.maxSelfReferentialDepth
      ) return true;
      if (selection.selectionSet) {
        const childType = getNamedType(field.type);
        if (isCompositeType(childType)) {
          const references = new Map(state.references);
          references.set(referenceKey, referenceCount);
          if (selectionExceedsDepth(
            context,
            selection.selectionSet,
            childType,
            fragments,
            { depth, listDepth, references },
            activeFragments,
            budget,
          )) return true;
        }
      }
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const conditional = selection.typeCondition
        ? context.getSchema().getType(selection.typeCondition.name.value)
        : parentType;
      if (conditional && isCompositeType(conditional) && selectionExceedsDepth(
        context,
        selection.selectionSet,
        conditional,
        fragments,
        state,
        activeFragments,
        budget,
      )) return true;
      continue;
    }

    const fragmentName = selection.name.value;
    if (activeFragments.has(fragmentName)) continue;
    const fragment = fragments.get(fragmentName);
    const conditional = fragment
      ? context.getSchema().getType(fragment.typeCondition.name.value)
      : null;
    if (fragment && conditional && isCompositeType(conditional)) {
      const nextFragments = new Set(activeFragments);
      nextFragments.add(fragmentName);
      if (selectionExceedsDepth(
        context,
        fragment.selectionSet,
        conditional,
        fragments,
        state,
        nextFragments,
        budget,
      )) return true;
    }
  }
  return false;
}

export const graphqlDepthRule: ValidationRule = (context) => ({
  Document(document) {
    const budget = { remaining: MAX_GRAPHQL_EXPANDED_SELECTIONS };
    const fragments = new Map(document.definitions.flatMap((definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? [[definition.name.value, definition] as const]
        : [],
    ));
    for (const definition of document.definitions) {
      if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
      const root = operationRoot(context, definition);
      if (root && selectionExceedsDepth(
        context,
        definition.selectionSet,
        root,
        fragments,
        { depth: 0, listDepth: 0, references: new Map() },
        new Set(),
        budget,
      )) {
        context.reportError(new GraphQLError(
          "GraphQL operation exceeds the allowed selection depth or expansion budget.",
          { nodes: definition },
        ));
      }
    }
  },
});

// Codes whose message is written for the user (guard reasons), not internals.
const REASON_CODES = new Set(["KS_VALIDATION_FAILURE", "LIFECYCLE_REFUSED"]);
// Command guards throw plain `Error`s whose text is written for the user. Prisma, driver and
// runtime failures are subclasses (or carry stack/SQL text), so they stay redacted.
const UNSAFE_DETAIL = /prisma|invocation|\bat\s+\S+\s*\(|node_modules|postgres(ql)?:\/\/|\bSQL\b|ECONN|query engine|\.ts:\d+|\.js:\d+|fetch failed|stripe|secret|token|password/i;
export function isAuthoredMessage(error: GraphQLError) {
  const original = error.originalError as (Error & { code?: unknown }) | undefined | null;
  if (!original || original.constructor?.name !== "Error" || original.code !== undefined) return false;
  const message = error.message;
  return typeof message === "string" && message.length > 0 && message.length <= 400 && !UNSAFE_DETAIL.test(message);
}

function reasonFromMessage(code: string, message: string) {
  if (code !== "KS_VALIDATION_FAILURE") return message;
  // Keystone prefixes "You provided invalid data for this operation:\n  - List.field: reason".
  return message.split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim()).filter(Boolean)
    .filter((line) => !/^You provided invalid data/i.test(line)).join(" ").slice(0, 500) || message;
}

export function redactGraphqlExecutionResult(result: ExecutionResult): ExecutionResult {
  if (!result.errors?.length) return result;
  return {
    ...result,
    errors: result.errors.map((error) => {
      const code = typeof error.extensions?.code === "string" ? error.extensions.code : undefined;
      if (isAuthoredMessage(error)) {
        return new GraphQLError(error.message, {
          nodes: error.nodes, source: error.source, positions: error.positions, path: error.path,
          extensions: { code: code ?? "COMMAND_REFUSED" },
        });
      }
      if (code && REASON_CODES.has(code) && error.message) {
        return new GraphQLError(reasonFromMessage(code, error.message), {
          nodes: error.nodes, source: error.source, positions: error.positions, path: error.path, extensions: { code },
        });
      }
      return new GraphQLError("The request could not be completed. Check your access and submitted information, then try again.", {
        nodes: error.nodes,
        source: error.source,
        positions: error.positions,
        path: error.path,
        extensions: code ? { code } : undefined,
      });
    }),
  };
}

const graphqlNoIntrospectionPlugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(NoSchemaIntrospectionCustomRule);
  },
} satisfies Plugin;

const graphqlErrorRedactionPlugin = {
  onResultProcess({ result, setResult }) {
    if (result && typeof result === "object" && Symbol.asyncIterator in result) {
      const stream = result as AsyncIterable<ExecutionResult>;
      setResult((async function* redactStream() {
        for await (const payload of stream) yield redactGraphqlExecutionResult(payload);
      })());
      return;
    }
    setResult(Array.isArray(result)
      ? result.map(redactGraphqlExecutionResult)
      : redactGraphqlExecutionResult(result));
  },
} satisfies Plugin;

const graphqlDepthPlugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(graphqlDepthRule);
  },
} satisfies Plugin;

export const graphqlSecurityPlugins = [
  graphqlDepthPlugin,
  graphqlNoIntrospectionPlugin,
  graphqlErrorRedactionPlugin,
] as const;

export function graphqlTransportRejection(input: {
  method?: string;
  contentType?: string;
  secFetchSite?: string;
  origin?: string;
  requestOrigin?: string;
  internalVerified?: boolean;
}) {
  if (input.method !== "POST") return { status: 405, message: "GraphQL accepts POST requests only." };
  if (input.secFetchSite?.toLowerCase() === "cross-site") {
    return { status: 403, message: "Cross-site GraphQL requests are not accepted." };
  }
  const contentType = input.contentType?.toLowerCase() ?? "";
  const isJson = /^application\/json(?:\s*;|$)/.test(contentType);
  const isMultipart = /^multipart\/form-data(?:\s*;|$)/.test(contentType);
  if (!isJson && !isMultipart) {
    return { status: 415, message: "GraphQL requires JSON or same-origin multipart form data." };
  }
  // Only the server-side loopback HMAC verifier may grant this exception.
  // Unsigned browser uploads retain the exact same-origin requirement.
  if (isMultipart && !input.internalVerified) {
    if (!input.origin || !input.requestOrigin) {
      return { status: 403, message: "Multipart GraphQL requests require an exact same-origin browser request." };
    }
    try {
      if (new URL(input.origin).origin !== new URL(input.requestOrigin).origin) {
        return { status: 403, message: "Multipart GraphQL origin does not match the application origin." };
      }
    } catch {
      return { status: 403, message: "Multipart GraphQL origin is invalid." };
    }
  }
  return null;
}

export function requestBodyIsTooLarge(contentLength: string | string[] | undefined) {
  const raw = Array.isArray(contentLength) ? contentLength[0] : contentLength;
  if (!raw) return false;
  const bytes = Number(raw);
  return !Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_GRAPHQL_BODY_BYTES;
}

export class GraphqlRequestBodyError extends Error {
  constructor(
    readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = "GraphqlRequestBodyError";
  }
}

export async function readBoundedJsonBody(
  body: AsyncIterable<Uint8Array | string>,
  maxBytes = MAX_GRAPHQL_BODY_BYTES,
) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of body) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.byteLength;
    if (totalBytes > maxBytes) {
      throw new GraphqlRequestBodyError(413, "GraphQL request body is too large.");
    }
    chunks.push(bytes);
  }
  if (!totalBytes) throw new GraphqlRequestBodyError(400, "GraphQL request body must contain JSON.");
  try {
    const parsed = JSON.parse(Buffer.concat(chunks, totalBytes).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || !Object.keys(parsed).length) {
      throw new Error("empty JSON payload");
    }
    return parsed;
  } catch {
    throw new GraphqlRequestBodyError(400, "GraphQL request body contains invalid JSON.");
  }
}

// Yoga masks any non-GraphQLError before result plugins run. Let authored command-guard
// messages through (same rule as the redaction plugin) and keep everything else masked.
export function maskGraphqlError(error: unknown, message: string, isDev?: boolean) {
  if (error instanceof GraphQLError && isAuthoredMessage(error)) {
    return new GraphQLError(error.message, {
      nodes: error.nodes, source: error.source, positions: error.positions, path: error.path,
      extensions: { code: "COMMAND_REFUSED" },
    });
  }
  return maskError(error, message, isDev);
}
