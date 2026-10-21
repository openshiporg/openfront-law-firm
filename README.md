# Openfront Law Firm

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-law-firm&env=DATABASE_URL%2CSESSION_SECRET)

Openfront Law Firm is a self-hostable legal practice and client-collaboration application. Visitors can explore practice areas and attorneys or request consultations. Firm teams manage intake, conflicts, matters, deadlines, documents, communication, time, expenses, billing, trust records, and scoped client sharing.

## Demo

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-law-firm)

[Documentation →](https://docs.openship.org/docs/openfront/law-firm/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Law Firm**: (This repository) a self-hostable legal practice and client-collaboration application.

## Core Features

### Admin Dashboard
Manage accounting, branding, portal, time expenses, today, contacts, intake, integrations, team, ai, work, governance through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
Public routes include `/practice-areas`, `/attorneys`, `/consultation`, and customer accounts. The `/portal` and `/portal/share/[shareId]` surfaces provide explicitly granted client collaboration.

### Intake, Conflicts & Matters
Capture intake, track parties, run and resolve conflict reviews, organize matters and teams, and manage ethical walls, calendaring, dockets, and tasks.

### Documents & Client Collaboration
Maintain document versions, communication workflows, portal grants, invitations, and resource-specific client shares.

### Billing, Trust & Governance
Record time, expenses, invoices, retainer workflows, trust transactions, reconciliation, retention, and controlled agent actions. Ledger records do not imply bank movement, legal advice, or professional compliance certification.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-law-firm/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Firms, offices, memberships, contacts, intake, conflict records, and matters.
- Matter parties, teams, ethical walls, courts, dockets, deadlines, and tasks.
- Documents, versions, communications, client portal grants, and shares.
- Time, expenses, billing, payments, trust ledgers, provider connections, credentials, agents, and retention.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-law-firm.git
   cd openfront-law-firm
   npm install
   ```

2. **Configure environment variables:**
   Create a local `.env` file using the [runtime configuration](features/keystone/index.ts) as the authority.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

3. **Start development server:**
   ```bash
   npm run schema:build
   npm run migrate
   npm run dev
   ```

   Apply migrations explicitly: the development script prepares the backend schema and starts Next.js, but does not apply database migrations.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **Customer account**: `/account`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Visit `/dashboard/init` on an empty database to create the initial administrator, then sign in to the dashboard.

6. **Run application onboarding:**
   Complete firm onboarding at `/dashboard/onboarding`, then configure firm membership, roles, practice areas, intake, billing settings, and portal policy.

## Development Commands

- `npm run dev` - Prepare the backend schema, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Prepare the schema and generate/apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.
- `npm run typecheck` - Run the configured TypeScript check.
- `npm run test` - Run the repository's configured test suite.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Provider & Agent Integration
The [business commands](features/keystone/mutations/index.ts) include provider workflows, credentials, agent requests and review, document versions, billing, and trust posting. Connect external providers and review delegated grants separately; a stored connection is not proof of a completed external action.

## Documentation

See the [Openfront Law Firm documentation](https://docs.openship.org/docs/openfront/law-firm/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageIntake` - Manage intake.
- `canRunConflictChecks` - Run conflict checks.
- `canResolveConflicts` - Resolve conflicts.
- `canManageMatters` - Manage matters.
- `canManageEthicalWalls` - Manage ethical walls.
- `canManageTrust` - Manage trust.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Active firm memberships and firm-owned roles control capabilities. Matter authority, ethical walls, and exact portal resource grants narrow record access; machine scopes cannot supply a missing current owner permission.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Accounting**: `/dashboard/platform/accounting`.
- **Branding**: `/dashboard/platform/branding`.
- **Portal**: `/dashboard/platform/portal`.
- **Time Expenses**: `/dashboard/platform/time-expenses`.
- **Today**: `/dashboard/platform/today`.
- **Contacts**: `/dashboard/platform/contacts`.
- **Intake**: `/dashboard/platform/intake`.
- **Integrations**: `/dashboard/platform/integrations`.
- **Team**: `/dashboard/platform/team`.
- **Ai**: `/dashboard/platform/ai`.
- **Work**: `/dashboard/platform/work`.
- **Governance**: `/dashboard/platform/governance`.

### Storefront Experience
Public routes include `/practice-areas`, `/attorneys`, `/consultation`, and customer accounts. The `/portal` and `/portal/share/[shareId]` surfaces provide explicitly granted client collaboration.

Capture intake, track parties, run and resolve conflict reviews, organize matters and teams, and manage ethical walls, calendaring, dockets, and tasks.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Keep the shared PostgreSQL database, session secrets, and configured object storage consistent across application processes. Review background delivery and integration requirements before choosing a serverless runtime; a source import does not supply persistent workers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Support

- **Documentation**: [Openfront Law Firm guide](https://docs.openship.org/docs/openfront/law-firm/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-law-firm/issues).
- **Product**: [Learn more about Openfront Law Firm](https://openship.org/products/openfront-law-firm).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
