/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');

const REQUIRED_WIDTHS = [320, 375, 768, 1440];
const REQUIRED_PORTAL_STATES = [
  'invitation-accept-form', 'index', 'exact-share', 'outsider-denied',
  'signed-out-denied', 'signed-out-token-replay-denied',
  'reinvited-share-before-grant-revocation', 'grant-revoked-denied',
];
const REQUIRED_FAIL_CLOSED_STATES = ['legal-ai-provider-mcp-webhook'];

function expectedMatrixKeys(result) {
  const keys = [];
  for (const width of REQUIRED_WIDTHS) {
    keys.push(`${width}:public:/`);
    for (const route of result.staffRoutes) keys.push(`${width}:staff:${route}`);
    for (const route of result.legalAiRoutes) keys.push(`${width}:legal-ai:${route}`);
    for (const state of result.portalStates) keys.push(`${width}:portal:${state}`);
    for (const state of result.failClosedStates) keys.push(`${width}:fail-closed:${state}`);
  }
  return keys.sort();
}

function validateFailureRecord(record, label) {
  assert.equal(typeof record.kind, 'string', `${label}.kind`);
  assert.equal(typeof record.message, 'string', `${label}.message`);
  assert.equal(typeof record.expected, 'boolean', `${label}.expected`);
}

function validateMatrixResult(result) {
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.widths, REQUIRED_WIDTHS);
  assert.match(result.sourceRootSha256, /^[a-f0-9]{64}$/);
  for (const key of ['staffRoutes', 'legalAiRoutes', 'portalStates', 'failClosedStates', 'cells']) {
    assert(Array.isArray(result[key]) && result[key].length > 0, key);
  }
  assert.equal(result.staffRoutes.length, 18, 'staffRoutes.length');
  assert.equal(result.legalAiRoutes.length, 8, 'legalAiRoutes.length');
  assert(result.staffRoutes.includes('/dashboard/platform/team'), 'staff team route');
  assert(result.staffRoutes.includes('/dashboard/platform/portal'), 'staff portal route');
  assert(result.staffRoutes.includes('/dashboard/models'), 'staff model route');
  assert(result.staffRoutes.some((route) => /^\/dashboard\/platform\/matters\/[^/]+$/.test(route)), 'staff matter detail route');
  assert(result.legalAiRoutes.includes('/dashboard/platform/ai/providers'), 'Legal AI providers route');
  assert(result.legalAiRoutes.some((route) => /^\/dashboard\/platform\/ai\/matters\/[^/]+$/.test(route)), 'Legal AI matter route');
  assert(result.legalAiRoutes.some((route) => /^\/dashboard\/platform\/ai\/reviews\/[^/]+$/.test(route)), 'Legal AI review detail route');
  assert.deepEqual(result.portalStates, REQUIRED_PORTAL_STATES);
  assert.deepEqual(result.failClosedStates, REQUIRED_FAIL_CLOSED_STATES);
  const expectedKeys = expectedMatrixKeys(result);
  assert.equal(result.expectedCells, expectedKeys.length);
  assert.equal(result.cells.length, expectedKeys.length);
  const actualKeys = [];
  for (const [index, cell] of result.cells.entries()) {
    const label = `cells[${index}]`;
    assert(REQUIRED_WIDTHS.includes(cell.width), `${label}.width`);
    assert.deepEqual(cell.viewport, { width: cell.width, height: cell.width < 700 ? 812 : 900 }, `${label}.viewport`);
    assert.equal(typeof cell.category, 'string', `${label}.category`);
    assert.equal(typeof cell.name, 'string', `${label}.name`);
    assert.equal(cell.sourceRootSha256, result.sourceRootSha256, `${label}.sourceRootSha256`);
    assert.equal(typeof cell.authorization?.expectation, 'string', `${label}.authorization.expectation`);
    assert(cell.authorization.expectation.length > 0, `${label}.authorization.expectation.empty`);
    assert.equal(typeof cell.authorization?.result, 'string', `${label}.authorization.result`);
    assert(cell.authorization.result.length > 0, `${label}.authorization.result.empty`);
    assert.equal(typeof cell.http?.expectation, 'string', `${label}.http.expectation`);
    assert(cell.http.expectation.length > 0, `${label}.http.expectation.empty`);
    assert.notEqual(cell.http?.result, undefined, `${label}.http.result`);
    assert.equal(typeof cell.resultState, 'string', `${label}.resultState`);
    assert(cell.resultState.length > 0, `${label}.resultState.empty`);
    assert(Array.isArray(cell.failures?.console), `${label}.failures.console`);
    assert(Array.isArray(cell.failures?.page), `${label}.failures.page`);
    assert(Array.isArray(cell.failures?.request), `${label}.failures.request`);
    assert(Array.isArray(cell.http?.responses), `${label}.http.responses`);
    for (const [responseIndex, response] of cell.http.responses.entries()) {
      assert.equal(typeof response.status, 'number', `${label}.http.responses[${responseIndex}].status`);
      assert.equal(typeof response.url, 'string', `${label}.http.responses[${responseIndex}].url`);
      assert.equal(typeof response.expected, 'boolean', `${label}.http.responses[${responseIndex}].expected`);
      assert.equal(response.expected, true, `${label}.http.responses[${responseIndex}].unexpected`);
    }
    for (const [kind, records] of Object.entries(cell.failures)) {
      for (const [recordIndex, record] of records.entries()) validateFailureRecord(record, `${label}.failures.${kind}[${recordIndex}]`);
    }
    assert.equal(cell.failures.console.filter((item) => !item.expected).length, 0, `${label}.unexpectedConsoleFailures`);
    assert.equal(cell.failures.page.filter((item) => !item.expected).length, 0, `${label}.unexpectedPageFailures`);
    assert.equal(cell.failures.request.filter((item) => !item.expected).length, 0, `${label}.unexpectedRequestFailures`);
    assert.equal(cell.overflow?.passed, true, `${label}.overflow.passed`);
    assert.equal(cell.overflow?.innerWidth, cell.width, `${label}.overflow.innerWidth`);
    assert.equal(typeof cell.overflow?.scrollWidth, 'number', `${label}.overflow.scrollWidth`);
    assert(cell.overflow.scrollWidth <= cell.overflow.innerWidth + 1, `${label}.overflow.geometry`);
    assert.equal(typeof cell.screenshot?.path, 'string', `${label}.screenshot.path`);
    assert(cell.screenshot.path.length > 0, `${label}.screenshot.path.empty`);
    assert.match(cell.screenshot?.sha256, /^[a-f0-9]{64}$/, `${label}.screenshot.sha256`);
    actualKeys.push(`${cell.width}:${cell.category}:${cell.name}`);
  }
  assert.deepEqual(actualKeys.sort(), expectedKeys, 'matrix completeness');
  assert.equal(result.cells.filter((cell) => cell.category === 'fail-closed').length, REQUIRED_WIDTHS.length * result.failClosedStates.length);
  assert.equal(result.signOutSessionReplayDeniedWidths.length, REQUIRED_WIDTHS.length);
  assert.deepEqual([...result.signOutSessionReplayDeniedWidths].sort((a, b) => a - b), REQUIRED_WIDTHS);
  return true;
}

module.exports = {
  REQUIRED_WIDTHS,
  REQUIRED_PORTAL_STATES,
  REQUIRED_FAIL_CLOSED_STATES,
  expectedMatrixKeys,
  validateMatrixResult,
};
