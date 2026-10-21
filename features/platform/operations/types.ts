export type PracticeOverviewMetric = {
  key: string;
  label: string;
  value: number;
  href: string;
};

export type PracticeOverviewQueueItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: string;
  at: string | null;
  href: string;
  canAct: boolean;
};

export type PracticeOverview = {
  firmId: string;
  firmName: string;
  generatedAt: string;
  metrics: PracticeOverviewMetric[];
  intakeQueue: PracticeOverviewQueueItem[];
  matterQueue: PracticeOverviewQueueItem[];
  workQueue: PracticeOverviewQueueItem[];
  billingQueue: PracticeOverviewQueueItem[];
  governanceQueue: PracticeOverviewQueueItem[];
};

export type PracticeOverviewResponse = {
  success: true;
  data: PracticeOverview;
} | {
  success: false;
  error: string;
};

export type PracticeWorkspacePageInfo = {
  page: number;
  pageSize: number;
  pageCount: number;
  loadedCount: number;
  firstItem: number;
  lastItem: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type PracticeWorkspaceSection = {
  key: string;
  title: string;
  description: string;
  total: number;
  items: PracticeOverviewQueueItem[];
  pagination?: PracticeWorkspacePageInfo;
};

export type BillingInvoiceMetadataRegister = {
  success: true;
  total: number;
  items: Array<{
    id: string;
    invoiceNumber: string | null;
    status: string | null;
    createdAt: string | null;
    dueAt: string | null;
    totalMinor: number | null;
    balanceDueMinor: number | null;
    currencyCode: string | null;
    clientName: string | null;
    matterId: string | null;
    matterNumber: string | null;
  }>;
  pagination: PracticeWorkspacePageInfo;
} | {
  success: false;
  error: string;
};

export type PracticeWorkspace = {
  category: string;
  generatedAt: string;
  metrics: PracticeOverviewMetric[];
  sections: PracticeWorkspaceSection[];
  invoiceMetadataRegister?: BillingInvoiceMetadataRegister;
  notices: string[];
};

export type PracticeWorkspaceResponse = {
  success: true;
  data: PracticeWorkspace;
} | {
  success: false;
  error: string;
};
