import { keystoneContext } from '../../features/keystone/context'
import { createYoga } from "graphql-yoga";
import processRequest from "graphql-upload/processRequest.js";
import { type NextApiRequest, type NextApiResponse } from 'next'

import { getRequestBaseUrl } from '../../features/dashboard/lib/internalAppOrigin'
import { verifiedInternalIdentity } from '../../features/keystone/security/internalIdentity'
import { authenticateBearerToken } from '../../features/keystone/lib/machine-auth'
import {
  GraphqlRequestBodyError,
  graphqlSecurityPlugins,
  graphqlTransportRejection,
  maskGraphqlError,
  MAX_GRAPHQL_BODY_BYTES,
  MAX_GRAPHQL_UPLOAD_BYTES,
  MAX_GRAPHQL_UPLOAD_FILES,
  readBoundedJsonBody,
  requestBodyIsTooLarge,
} from '../../features/keystone/lib/graphql-security'

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestOrigin = getRequestBaseUrl({
    get: (name) => {
      const value = req.headers[name];
      return typeof value === "string" ? value : undefined;
    },
  });
  const contentType = String(req.headers["content-type"] ?? "");
  const rejection = graphqlTransportRejection({
    method: req.method,
    contentType,
    secFetchSite: String(req.headers["sec-fetch-site"] ?? ""),
    origin: typeof req.headers.origin === "string" ? req.headers.origin : undefined,
    requestOrigin,
    internalVerified: Boolean(verifiedInternalIdentity(req.headers, req.socket.remoteAddress)),
  });
  if (rejection) {
    if (rejection.status === 405) res.setHeader("Allow", "POST");
    return res.status(rejection.status).json({ errors: [{ message: rejection.message }] });
  }
  const isMultipart = contentType.toLowerCase().startsWith("multipart/form-data");
  if (!isMultipart && requestBodyIsTooLarge(req.headers["content-length"])) {
    return res.status(413).json({ errors: [{ message: "GraphQL request body is too large." }] });
  }
  if (isMultipart) {
    try {
      req.body = await processRequest(req, res, {
        maxFieldSize: MAX_GRAPHQL_BODY_BYTES,
        maxFileSize: MAX_GRAPHQL_UPLOAD_BYTES,
        maxFiles: MAX_GRAPHQL_UPLOAD_FILES,
      });
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error && error.status === 413
        ? 413
        : 400;
      return res.status(status).json({ errors: [{ message: "Multipart GraphQL request is invalid or too large." }] });
    }
  } else {
    try {
      req.body = await readBoundedJsonBody(req);
    } catch (error) {
      const rejection = error instanceof GraphqlRequestBodyError
        ? error
        : new GraphqlRequestBodyError(400, "GraphQL request body could not be read.");
      return res.status(rejection.status).json({ errors: [{ message: rejection.message }] });
    }
  }

  return createYoga({
    graphiql: false,
    graphqlEndpoint: "/api/graphql",
    schema: keystoneContext.graphql.schema,
    maskedErrors: { maskError: maskGraphqlError },
    plugins: [...graphqlSecurityPlugins],
    context: async ({ req, res }: { req: any; res: any }) => {
      const requestContext = await keystoneContext.withRequest(req, res);
      const machine = await authenticateBearerToken(
        req.headers.authorization,
        requestContext.prisma,
      );
      return machine.presented
        ? requestContext.withSession(machine.session ?? undefined)
        : requestContext;
    },
    multipart: false,
  })(req, res);
}