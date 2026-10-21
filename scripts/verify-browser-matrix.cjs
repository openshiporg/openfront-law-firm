/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('/Users/junaid/Code/openfronts/openfront-convenience/node_modules/playwright');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  REQUIRED_WIDTHS,
  REQUIRED_PORTAL_STATES,
  REQUIRED_FAIL_CLOSED_STATES,
  expectedMatrixKeys,
  validateMatrixResult,
} = require('./browser-matrix-contract.cjs');

const base = process.env.LAW_FIRM_BROWSER_BASE || 'https://law-firm.local';
const outputDir = process.env.LAW_FIRM_BROWSER_OUTPUT;
const sourceRootSha256 = process.env.LAW_FIRM_SOURCE_ROOT;
const fixture = JSON.parse(process.env.LAW_BROWSER_FIXTURE || '{}');
if (!outputDir) throw new Error('LAW_FIRM_BROWSER_OUTPUT is required.');
if (!/^[a-f0-9]{64}$/.test(sourceRootSha256 || '')) throw new Error('LAW_FIRM_SOURCE_ROOT must be the exact 64-character source-root SHA-256.');
for (const key of ['contactId', 'matterId', 'invoiceId', 'invoiceNumber', 'internalDocumentId']) {
  if (!fixture[key]) throw new Error(`LAW_BROWSER_FIXTURE.${key} is required.`);
}
fs.mkdirSync(outputDir, { recursive: true });

const widths = REQUIRED_WIDTHS;
const staffRoutes = [
  '/dashboard', '/dashboard/models', '/dashboard/platform/intake', '/dashboard/platform/matters',
  `/dashboard/platform/matters/${fixture.matterId}`, '/dashboard/platform/contacts',
  '/dashboard/platform/work', '/dashboard/platform/documents', '/dashboard/platform/communications',
  '/dashboard/platform/time-expenses', '/dashboard/platform/billing', '/dashboard/platform/accounting',
  '/dashboard/platform/portal', '/dashboard/platform/governance', '/dashboard/platform/reports',
  '/dashboard/platform/team', '/dashboard/platform/data', '/dashboard/platform/integrations',
];
const legalAiRoutes = [
  '/dashboard/platform/ai', `/dashboard/platform/ai/matters/${fixture.matterId}`,
  '/dashboard/platform/ai/reviews', `/dashboard/platform/ai/reviews/${fixture.matterId}`,
  '/dashboard/platform/ai/workflows', '/dashboard/platform/ai/knowledge',
  '/dashboard/platform/ai/providers', '/dashboard/platform/ai/evaluation',
];
const portalStates = REQUIRED_PORTAL_STATES;
const failClosedStates = REQUIRED_FAIL_CLOSED_STATES;
const cells = [];
const signOutSessionReplayDeniedWidths = [];

function slug(value) {
  return value.replace(/^\//, '').replaceAll('/', '__').replace(/[^a-zA-Z0-9_-]/g, '_') || 'home';
}
function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function observe(page, label) {
  const records = { console: [], page: [], request: [], responses: [] };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    records.console.push({ kind: 'console', message: `${label}:${text}`, expected: text.includes('status of 501') });
  });
  page.on('pageerror', (error) => records.page.push({ kind: 'page', message: `${label}:${error.message}`, expected: false }));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || '';
    records.request.push({ kind: 'request', message: `${label}:${request.url()}:${failure}`, expected: failure.includes('ERR_ABORTED') });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const expected = response.status() === 501 && (response.url().includes('/api/completion') || response.url().includes('/api/mcp-transport'));
    records.responses.push({ status: response.status(), url: response.url(), expected });
  });
  return {
    mark: () => Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])),
    since: (mark) => Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.slice(mark[key])])),
  };
}
async function overflowGeometry(page) {
  const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  return { ...geometry, passed: geometry.scrollWidth <= geometry.innerWidth + 1 };
}
async function captureCell({ page, observer, mark, width, category, name, authorizationExpectation, authorizationResult, httpExpectation, httpResult, resultState }) {
  const viewport = { width, height: width < 700 ? 812 : 900 };
  const overflow = await overflowGeometry(page);
  assert.equal(overflow.passed, true, `${width}:${category}:${name}:overflow`);
  const file = path.join(outputDir, `${width}__${category}__${slug(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const observed = observer.since(mark);
  const failures = { console: observed.console, page: observed.page, request: observed.request };
  for (const [kind, values] of Object.entries(failures)) {
    assert.equal(values.filter((item) => !item.expected).length, 0, `${width}:${category}:${name}:${kind}`);
  }
  assert.equal(observed.responses.filter((item) => !item.expected).length, 0, `${width}:${category}:${name}:http`);
  cells.push({
    width,
    viewport,
    category,
    name,
    sourceRootSha256,
    authorization: { expectation: authorizationExpectation, result: authorizationResult },
    http: { expectation: httpExpectation, result: httpResult, responses: observed.responses },
    resultState,
    failures,
    overflow,
    screenshot: { path: path.basename(file), sha256: sha256File(file) },
  });
}
async function graphql(page, query, variables = {}) {
  return page.evaluate(async ({ query, variables }) => {
    const response = await fetch('/api/graphql', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return { status: response.status, body: await response.json() };
  }, { query, variables });
}
async function login(page, width) {
  await page.goto(`${base}/dashboard/signin`, { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', 'law-firm@openship.org');
  await page.fill('input[name=password]', 'Helloworld123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30000 });
  const branding = await graphql(page, '{ firms(take: 100) { name displayName shortName slug } }');
  assert(!branding.body.errors, JSON.stringify(branding.body.errors));
  assert(branding.body.data.firms.some((firm) => firm.name === 'Harbor & Pine Legal PLLC' && firm.displayName === 'Harbor & Pine Legal' && firm.shortName === 'Harbor & Pine' && firm.slug === 'harbor-pine-legal'));
  assert.equal((await overflowGeometry(page)).passed, true, `staff-login-${width}`);
}
function replayCookie(cookie) {
  return {
    name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path,
    expires: cookie.expires, httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const width of widths) {
    const height = width < 700 ? 812 : 900;

    const publicContext = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
    const publicPage = await publicContext.newPage();
    const publicObserver = observe(publicPage, `public-${width}`);
    const publicMark = publicObserver.mark();
    const publicResponse = await publicPage.goto(base, { waitUntil: 'networkidle' });
    assert.equal(publicResponse.status(), 200);
    await captureCell({
      page: publicPage, observer: publicObserver, mark: publicMark, width, category: 'public', name: '/',
      authorizationExpectation: 'public access', authorizationResult: 'public page rendered without a session',
      httpExpectation: 'HTTP 200', httpResult: { status: publicResponse.status(), url: publicPage.url() }, resultState: 'landing page rendered',
    });
    await publicContext.close();

    const adminContext = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
    const adminPage = await adminContext.newPage();
    const adminObserver = observe(adminPage, `staff-${width}`);
    await login(adminPage, width);

    for (const route of staffRoutes) {
      const mark = adminObserver.mark();
      const response = await adminPage.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${width}:${route}`);
      await captureCell({
        page: adminPage, observer: adminObserver, mark, width, category: 'staff', name: route,
        authorizationExpectation: 'authenticated active Harbor & Pine administrator with route permission',
        authorizationResult: 'authorized staff route rendered', httpExpectation: 'HTTP 200',
        httpResult: { status: response.status(), url: adminPage.url() }, resultState: 'staff route rendered',
      });
    }
    for (const route of legalAiRoutes) {
      const mark = adminObserver.mark();
      const response = await adminPage.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${width}:${route}`);
      await captureCell({
        page: adminPage, observer: adminObserver, mark, width, category: 'legal-ai', name: route,
        authorizationExpectation: 'authenticated staff with bounded matter and Legal AI read authority',
        authorizationResult: 'authorized bounded Legal AI surface rendered', httpExpectation: 'HTTP 200',
        httpResult: { status: response.status(), url: adminPage.url() }, resultState: 'Legal AI route rendered without model execution',
      });
    }

    const failClosedMark = adminObserver.mark();
    const failClosedPageResponse = await adminPage.goto(`${base}/dashboard/platform/ai`, { waitUntil: 'networkidle' });
    const aiText = await adminPage.locator('body').innerText();
    assert.match(aiText, /Evidence-first and fail-closed/);
    assert.match(aiText, /Model execution is not configured/);
    const completion = await adminPage.evaluate(async () => {
      const response = await fetch('/api/completion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(completion.status, 501);
    assert.equal(completion.body.code, 'LEGAL_AI_EXECUTION_UNAVAILABLE');
    const mcp = await adminPage.evaluate(async () => {
      const response = await fetch('/api/mcp-transport/http', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(mcp.status, 501);
    assert.equal(mcp.body.code, 'LEGAL_MCP_DISABLED');
    const webhookAttempt = await graphql(adminPage, 'mutation { recordWebhookDeliveryAttempt(deliveryId: "missing", providerEventId: "caller-event", responseStatus: 204) { replayed } }');
    assert.equal(webhookAttempt.status, 200);
    assert.match(JSON.stringify(webhookAttempt.body.errors), /Cannot query field.*recordWebhookDeliveryAttempt/);
    await captureCell({
      page: adminPage, observer: adminObserver, mark: failClosedMark, width, category: 'fail-closed', name: failClosedStates[0],
      authorizationExpectation: 'authenticated staff may view bounded preparation surfaces but cannot invoke unavailable providers',
      authorizationResult: 'staff session authenticated; completion, MCP, and webhook outcome execution denied',
      httpExpectation: 'surface HTTP 200; completion and MCP HTTP 501; webhook mutation absent with GraphQL validation error',
      httpResult: { surface: failClosedPageResponse.status(), completion: completion.status, completionCode: completion.body.code, mcp: mcp.status, mcpCode: mcp.body.code, webhookGraphqlStatus: webhookAttempt.status, webhookMutationAbsent: true },
      resultState: 'all AI/provider/MCP execution boundaries failed closed',
    });

    const inviteEmail = `runtime-browser-${width}-${Date.now()}@example.invalid`;
    const invite = await graphql(adminPage, `mutation($contactId: ID!, $email: String!) { invitePortalAccount(contactId: $contactId, email: $email) { account { id status } inviteToken } }`, { contactId: fixture.contactId, email: inviteEmail });
    assert.equal(invite.status, 200);
    assert(!invite.body.errors, JSON.stringify(invite.body.errors));
    const accountId = invite.body.data.invitePortalAccount.account.id;
    const token = invite.body.data.invitePortalAccount.inviteToken;

    const portalContext = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
    const portalPage = await portalContext.newPage();
    const portalObserver = observe(portalPage, `portal-${width}`);
    let portalMark = portalObserver.mark();
    const acceptResponse = await portalPage.goto(`${base}/portal/accept?token=${encodeURIComponent(token)}`, { waitUntil: 'networkidle' });
    await captureCell({
      page: portalPage, observer: portalObserver, mark: portalMark, width, category: 'portal', name: 'invitation-accept-form',
      authorizationExpectation: 'valid one-use invitation token; no portal session yet', authorizationResult: 'invitation form rendered for valid token',
      httpExpectation: 'HTTP 200', httpResult: { status: acceptResponse.status(), url: portalPage.url() }, resultState: 'invitation ready for acceptance',
    });
    portalMark = portalObserver.mark();
    await portalPage.click('button[type=submit]');
    await portalPage.waitForURL(`${base}/portal`, { timeout: 30000 });

    const policyRead = await graphql(adminPage, `{ portalPolicyWorkspace { latestRevision policy { revision } } }`);
    assert(!policyRead.body.errors, JSON.stringify(policyRead.body.errors));
    let policyRevision = policyRead.body.data.portalPolicyWorkspace.policy?.revision;
    if (!policyRevision) {
      const admitted = await graphql(adminPage, `mutation($revision: Int!) { recordPortalDiscoveryPolicy(expectedRevision: $revision, mode: "read_intersection", statuses: ["open"], reason: "Synthetic isolated browser policy review only.") { revision admission } }`, { revision: policyRead.body.data.portalPolicyWorkspace.latestRevision });
      assert(!admitted.body.errors, JSON.stringify(admitted.body.errors));
      assert.equal(admitted.body.data.recordPortalDiscoveryPolicy.admission, "admitted");
      policyRevision = admitted.body.data.recordPortalDiscoveryPolicy.revision;
    }
    const grant = await graphql(adminPage, `mutation($accountId: ID!, $matterId: ID!, $contactId: ID!, $revision: Int!, $key: String!) { grantPortalMatterAccess(portalAccountId: $accountId, matterId: $matterId, contactId: $contactId, policyRevision: $revision, expectedVersion: 0, idempotencyKey: $key, reason: "Synthetic exact browser grant intent.", canReadDocuments: true, canReadInvoices: true, canReadMessages: true) { id status version } }`, { accountId, matterId: fixture.matterId, contactId: fixture.contactId, revision: policyRevision, key: randomUUID() });
    assert(!grant.body.errors, JSON.stringify(grant.body.errors));
    const accessId = grant.body.data.grantPortalMatterAccess.id;
    const share = await graphql(adminPage, `mutation($accessId: ID!, $resourceId: ID!) { sharePortalResource(portalMatterAccessId: $accessId, resourceType: "invoice", resourceId: $resourceId) { id status } }`, { accessId, resourceId: fixture.invoiceId });
    assert(!share.body.errors, JSON.stringify(share.body.errors));
    const shareId = share.body.data.sharePortalResource.id;
    const deniedShare = await graphql(adminPage, `mutation($accessId: ID!, $resourceId: ID!) { sharePortalResource(portalMatterAccessId: $accessId, resourceType: "document", resourceId: $resourceId) { id status } }`, { accessId, resourceId: fixture.internalDocumentId });
    assert(deniedShare.body.errors?.length, 'internal document share must fail');

    await portalPage.goto(`${base}/portal`, { waitUntil: 'networkidle' });
    assert.match(await portalPage.locator('body').innerText(), /Invoice/);
    assert.match(await portalPage.locator('body').innerText(), /Harbor & Pine Legal/);
    await captureCell({
      page: portalPage, observer: portalObserver, mark: portalMark, width, category: 'portal', name: 'index',
      authorizationExpectation: 'newly accepted active portal session with exact account scope', authorizationResult: 'active portal session rendered exact shared index',
      httpExpectation: 'HTTP 200 after invitation acceptance redirect', httpResult: { status: 200, url: portalPage.url() }, resultState: 'portal session active',
    });
    portalMark = portalObserver.mark();
    const shareResponse = await portalPage.goto(`${base}/portal/share/${shareId}`, { waitUntil: 'networkidle' });
    assert.match(await portalPage.locator('body').innerText(), new RegExp(fixture.invoiceNumber));
    await captureCell({
      page: portalPage, observer: portalObserver, mark: portalMark, width, category: 'portal', name: 'exact-share',
      authorizationExpectation: 'active portal session plus exact matter grant and invoice share', authorizationResult: 'exact invoice rendered',
      httpExpectation: 'HTTP 200', httpResult: { status: shareResponse.status(), url: portalPage.url() }, resultState: 'exact shared invoice visible',
    });

    const outsiderContext = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
    const outsiderPage = await outsiderContext.newPage();
    const outsiderObserver = observe(outsiderPage, `portal-outsider-${width}`);
    const outsiderMark = outsiderObserver.mark();
    const outsiderResponse = await outsiderPage.goto(`${base}/portal/share/${shareId}`, { waitUntil: 'networkidle' });
    assert.doesNotMatch(await outsiderPage.locator('body').innerText(), new RegExp(fixture.invoiceNumber));
    await captureCell({
      page: outsiderPage, observer: outsiderObserver, mark: outsiderMark, width, category: 'portal', name: 'outsider-denied',
      authorizationExpectation: 'no portal session; exact share must be denied', authorizationResult: 'outsider received no invoice content',
      httpExpectation: 'bounded denial page', httpResult: { status: outsiderResponse.status(), url: outsiderPage.url() }, resultState: 'outsider denied',
    });
    await outsiderContext.close();

    const activeSessionCookie = (await portalContext.cookies()).find((cookie) => cookie.name === 'openfront-portal-session');
    assert(activeSessionCookie?.value, 'active portal session cookie must exist before sign-out');
    portalMark = portalObserver.mark();
    await portalPage.goto(`${base}/portal`, { waitUntil: 'networkidle' });
    await portalPage.click('button:has-text("Sign out")');
    await portalPage.waitForURL(/\/portal(?:\?|$)/, { timeout: 30000 });
    await portalPage.goto(`${base}/portal/share/${shareId}`, { waitUntil: 'networkidle' });
    assert.doesNotMatch(await portalPage.locator('body').innerText(), new RegExp(fixture.invoiceNumber));
    assert.equal((await portalContext.cookies()).some((cookie) => cookie.name === 'openfront-portal-session'), false);
    await captureCell({
      page: portalPage, observer: portalObserver, mark: portalMark, width, category: 'portal', name: 'signed-out-denied',
      authorizationExpectation: 'sign-out revokes server session and clears browser cookie', authorizationResult: 'signed-out browser lost the cookie and exact share was denied',
      httpExpectation: 'sign-out redirect and bounded denial page', httpResult: { status: 200, url: portalPage.url(), cookieCleared: true }, resultState: 'session revoked by sign-out',
    });

    const replayContext = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
    await replayContext.addCookies([replayCookie(activeSessionCookie)]);
    const replayPage = await replayContext.newPage();
    const replayObserver = observe(replayPage, `portal-session-replay-${width}`);
    const replayMark = replayObserver.mark();
    const replayResponse = await replayPage.goto(`${base}/portal/share/${shareId}`, { waitUntil: 'networkidle' });
    assert.doesNotMatch(await replayPage.locator('body').innerText(), new RegExp(fixture.invoiceNumber));
    await captureCell({
      page: replayPage, observer: replayObserver, mark: replayMark, width, category: 'portal', name: 'signed-out-token-replay-denied',
      authorizationExpectation: 'the exact pre-sign-out session token is server-revoked and cannot be replayed', authorizationResult: 'reinserted same token received no invoice content',
      httpExpectation: 'bounded denial page', httpResult: { status: replayResponse.status(), url: replayPage.url(), sameTokenReplayed: true }, resultState: 'same signed-out session token denied',
    });
    signOutSessionReplayDeniedWidths.push(width);
    await replayContext.close();

    const reinvite = await graphql(adminPage, `mutation($contactId: ID!, $email: String!) { invitePortalAccount(contactId: $contactId, email: $email) { inviteToken } }`, { contactId: fixture.contactId, email: inviteEmail });
    assert(!reinvite.body.errors, JSON.stringify(reinvite.body.errors));
    const renewedContext = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
    const renewedPage = await renewedContext.newPage();
    const renewedObserver = observe(renewedPage, `portal-renewed-${width}`);
    await renewedPage.goto(`${base}/portal/accept?token=${encodeURIComponent(reinvite.body.data.invitePortalAccount.inviteToken)}`, { waitUntil: 'networkidle' });
    await renewedPage.click('button[type=submit]');
    await renewedPage.waitForURL(`${base}/portal`, { timeout: 30000 });
    let renewedMark = renewedObserver.mark();
    const renewedShareResponse = await renewedPage.goto(`${base}/portal/share/${shareId}`, { waitUntil: 'networkidle' });
    assert.match(await renewedPage.locator('body').innerText(), new RegExp(fixture.invoiceNumber));
    await captureCell({
      page: renewedPage, observer: renewedObserver, mark: renewedMark, width, category: 'portal', name: 'reinvited-share-before-grant-revocation',
      authorizationExpectation: 'fresh portal session with still-active exact grant and share', authorizationResult: 'fresh session rendered the invoice before grant revocation',
      httpExpectation: 'HTTP 200', httpResult: { status: renewedShareResponse.status(), url: renewedPage.url() }, resultState: 'fresh session proves grant was active before revocation',
    });

    const revoked = await graphql(adminPage, `mutation($id: ID!, $accountId: ID!, $matterId: ID!, $contactId: ID!, $revision: Int!, $version: Int!, $key: String!) { revokePortalGrant(id: $id, grantType: "matter_access", portalAccountId: $accountId, matterId: $matterId, contactId: $contactId, policyRevision: $revision, expectedVersion: $version, idempotencyKey: $key, reason: "Four-width release verification revocation.") { id status replayed } }`, { id: accessId, accountId, matterId: fixture.matterId, contactId: fixture.contactId, revision: policyRevision, version: grant.body.data.grantPortalMatterAccess.version, key: randomUUID() });
    assert(!revoked.body.errors, JSON.stringify(revoked.body.errors));
    renewedMark = renewedObserver.mark();
    const revokedResponse = await renewedPage.goto(`${base}/portal/share/${shareId}`, { waitUntil: 'networkidle' });
    assert.doesNotMatch(await renewedPage.locator('body').innerText(), new RegExp(fixture.invoiceNumber));
    await captureCell({
      page: renewedPage, observer: renewedObserver, mark: renewedMark, width, category: 'portal', name: 'grant-revoked-denied',
      authorizationExpectation: 'active portal session but revoked matter grant must be denied', authorizationResult: 'same active session received no invoice after grant revocation',
      httpExpectation: 'bounded denial page', httpResult: { status: revokedResponse.status(), url: renewedPage.url() }, resultState: 'matter-grant revocation enforced',
    });

    await renewedContext.close();
    await portalContext.close();
    await adminContext.close();
  }
  await browser.close();

  const direct = await fetch('http://127.0.0.1:4310/api/health').then(async (response) => ({ status: response.status, body: await response.json() }));
  assert.equal(direct.status, 200);
  assert.equal(direct.body.status, 'ok');
  const result = {
    schemaVersion: 2,
    sourceRootSha256,
    widths,
    staffRoutes,
    legalAiRoutes,
    portalStates,
    failClosedStates,
    expectedCells: 0,
    signOutSessionReplayDeniedWidths,
    directHealth: direct.body,
    cells,
  };
  result.expectedCells = expectedMatrixKeys(result).length;
  validateMatrixResult(result);
  fs.writeFileSync(path.join(outputDir, 'browser-matrix.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    schemaVersion: result.schemaVersion,
    sourceRootSha256,
    widths,
    staffRoutes: staffRoutes.length,
    legalAiRoutes: legalAiRoutes.length,
    portalStates: portalStates.length,
    failClosedStates: failClosedStates.length,
    expectedCells: result.expectedCells,
    screenshotCells: cells.length,
    signOutSessionReplayDeniedWidths,
    directHealth: direct.body,
  }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
