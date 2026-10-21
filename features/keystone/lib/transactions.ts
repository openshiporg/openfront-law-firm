type TransactionCallback<T, Tx> = (transaction: Tx) => Promise<T>;

type PrismaLike<Tx> = {
  $transaction<T>(
    callback: TransactionCallback<T, Tx>,
    options: { isolationLevel: "Serializable"; maxWait: number; timeout: number },
  ): Promise<T>;
};

/**
 * Keystone adds a final Prisma query extension that turns database exceptions
 * into GraphQLError return values. Controlled transactions must use the parent
 * client so an exception aborts the PostgreSQL transaction instead of being
 * mistaken for a successful record.
 */
export function prismaWithoutGraphQLErrorConversion<T>(prisma: T): T {
  const parent = (prisma as any)?.$parent;
  return parent && parent !== prisma ? parent : prisma;
}

function isRetryableSerializableConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034",
  );
}

export async function runSerializableTransaction<T, Tx = unknown>(
  prisma: PrismaLike<Tx>,
  callback: TransactionCallback<T, Tx>,
  maxAttempts = 4,
): Promise<T> {
  let lastError: unknown;
  const transactionClient = prismaWithoutGraphQLErrorConversion(prisma);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await transactionClient.$transaction(callback, {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableSerializableConflict(error) || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 10));
    }
  }
  throw lastError;
}
