declare module "graphql-upload/processRequest.js" {
  import type { IncomingMessage, ServerResponse } from "node:http";

  type ProcessRequestOptions = {
    maxFieldSize?: number;
    maxFileSize?: number;
    maxFiles?: number;
  };

  export default function processRequest(
    request: IncomingMessage,
    response: ServerResponse,
    options?: ProcessRequestOptions,
  ): Promise<unknown>;
}
