export const GRAPHQL_INT_MIN = -2_147_483_648;
export const GRAPHQL_INT_MAX = 2_147_483_647;

export function isGraphqlInt(value: number): boolean {
  return Number.isInteger(value) && value >= GRAPHQL_INT_MIN && value <= GRAPHQL_INT_MAX;
}
