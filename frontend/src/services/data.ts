import { AssetItem, AuditEvent, CaseItem, CustodyAction, DocumentItem, Ticket } from "../types";

export const demoCases: CaseItem[] = [];
const handlerUsernames = [
  "handler1@scfca.local",
  "handler2@scfca.local",
  "handler3@scfca.local",
];
const assetSymbols = ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XMR", "ADA", "TRX", "AVAX", "LINK"];
for (let i = 0; i < 50; i++) {
  const handler = i < 10 ? "alice" : handlerUsernames[(i - 10) % handlerUsernames.length];
  const caseId = `SCFCA-CASE-2026-${(i + 1).toString().padStart(4, "0")}`;
  const walletRef = `WLT-${(1000 + i).toString().padStart(4, "0")}`;
  const investigationNames = [
    "GLOBE",
    "MARIPOSA",
    "FALCON-3",
    "NIGHTFALL",
    "EMBER",
    "SUNDIAL",
    "HARBOR",
    "COLDWIRE",
    "IRONCROWN",
    "SABLE",
    "RIVERSTONE",
    "CIPHER",
    "BLACKWELL",
    "SILENT COMET",
    "GHOST LANTERN",
    "VAULTLINE",
  ];
  const codename = investigationNames[i % investigationNames.length];
  const suffix = i >= investigationNames.length ? `-${Math.floor(i / investigationNames.length) + 1}` : "";
  const title = `Operation ${codename}${suffix}`;
  const custodyStatus = ["open", "in_review", "closed"][Math.floor(Math.random() * 3)] as "open" | "in_review" | "closed";
  const holdings = [];
  for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
    const symbol = assetSymbols[Math.floor(Math.random() * assetSymbols.length)];
    const balance = Math.round((Math.random() * 999.5 + 0.5) * 10000) / 10000;
    holdings.push({ symbol, balance });
  }
  demoCases.push({
    id: caseId,
    walletRef,
    title,
    handler,
    custodyStatus,
    holdings,
    summary:
      "Court-ordered freeze of digital assets pending trial. Prosecutor (case handler) uploads supporting evidence and court orders as the investigation progresses.",
    restrictedNotes:
      i < 10
        ? "Restricted (personal data): Subject currently incarcerated; assets seized under judge-approved freeze order. Contains identifiable information and evidence chain that must be visible only to the assigned prosecutor and administrators reviewing custody actions."
        : undefined,
  });
}

export const demoAssets: AssetItem[] = [
  {
    id: "AS-100",
    symbol: "BTC",
    assetType: "coin",
    balance: 1.25,
    protocol: "Native",
    network: "Bitcoin",
    walletRef: "WLT-1000",
    caseId: "SCFCA-CASE-2026-0001",
    status: "active"
  },
  {
    id: "AS-101",
    symbol: "USDT",
    assetType: "stablecoin",
    balance: 250000,
    protocol: "ERC-20",
    network: "Ethereum",
    walletRef: "WLT-1000",
    caseId: "SCFCA-CASE-2026-0001",
    status: "active"
  },
  {
    id: "AS-102",
    symbol: "ETH",
    assetType: "coin",
    balance: 42.0,
    protocol: "Native",
    network: "Ethereum",
    walletRef: "WLT-1003",
    caseId: "SCFCA-CASE-2026-0004",
    status: "active"
  },
  {
    id: "AS-103",
    symbol: "XMR",
    assetType: "coin",
    balance: 310.5,
    protocol: "Native",
    network: "Monero",
    walletRef: "WLT-1003",
    caseId: "SCFCA-CASE-2026-0004",
    status: "pending"
  },
  {
    id: "AS-104",
    symbol: "SOL",
    assetType: "coin",
    balance: 980.0,
    protocol: "Native",
    network: "Solana",
    walletRef: "WLT-1006",
    caseId: "SCFCA-CASE-2026-0007",
    status: "active"
  },
  {
    id: "AS-01",
    symbol: "BTC",
    assetType: "coin",
    balance: 12.5,
    protocol: "Native",
    network: "Bitcoin",
    walletRef: "WLT-8F3A-PRIMARY",
    caseId: "C-100",
    status: "active"
  },
  {
    id: "AS-02",
    symbol: "ETH",
    assetType: "coin",
    balance: 180,
    protocol: "Native",
    network: "Ethereum",
    walletRef: "WLT-8F3A-PRIMARY",
    caseId: "C-100",
    status: "active"
  },
  {
    id: "AS-03",
    symbol: "USDC",
    assetType: "stablecoin",
    balance: 500000,
    protocol: "ERC-20",
    network: "Ethereum",
    walletRef: "WLT-21C9-MSIG",
    caseId: "C-101",
    status: "pending"
  }
];

export const demoCustodyActions: CustodyAction[] = [
  {
    id: "ACT-401",
    createdAt: "2026-04-15 09:10",
    type: "transfer_request",
    status: "requested",
    requestedBy: "alice",
    walletRef: "WLT-1000",
    symbol: "USDT",
    amount: 50000,
    network: "Ethereum",
    protocol: "ERC-20",
    destination: "0x...demo_destination",
    caseId: "SCFCA-CASE-2026-0001",
    notes: "PoC transfer request tied to Operation GLOBE"
  },
  {
    id: "ACT-402",
    createdAt: "2026-04-16 13:45",
    type: "custody_movement",
    status: "in_review",
    requestedBy: "alice",
    walletRef: "WLT-1003",
    symbol: "ETH",
    amount: 5,
    network: "Ethereum",
    protocol: "Native",
    caseId: "SCFCA-CASE-2026-0004",
    notes: "PoC custody movement pending admin review"
  },
  {
    id: "ACT-300",
    createdAt: "2026-03-19 11:20",
    type: "transfer_request",
    status: "requested",
    requestedBy: "mark",
    walletRef: "WLT-8F3A-PRIMARY",
    symbol: "BTC",
    amount: 0.75,
    network: "Bitcoin",
    protocol: "Native",
    destination: "bc1q...demo_destination",
    caseId: "C-100",
    notes: "PoC transfer request (no signing/execution)"
  },
  {
    id: "ACT-301",
    createdAt: "2026-03-19 14:05",
    type: "custody_movement",
    status: "in_review",
    requestedBy: "bob",
    walletRef: "WLT-21C9-MSIG",
    symbol: "USDC",
    amount: 250000,
    network: "Ethereum",
    protocol: "ERC-20",
    caseId: "C-101",
    notes: "PoC custody movement request (internal re-allocation)"
  }
];

export const demoTickets: Ticket[] = [
  {
    id: "T-301",
    caseId: "SCFCA-CASE-2026-0001",
    ticketType: "transfer_request",
    description: "Transfer request: move seized assets to a pre-approved destination (PoC).",
    status: "pending_review",
    linkedDocumentIds: [],
    approvalHistory: [],
    createdBy: "alice",
    assignedTo: "bob"
  },
  {
    id: "T-302",
    caseId: "SCFCA-CASE-2026-0004",
    ticketType: "custody_change",
    description: "Custody change request: update custody policy / signer set (PoC).",
    status: "pending_review",
    linkedDocumentIds: [],
    approvalHistory: [],
    createdBy: "alice",
    assignedTo: "bob"
  },
  {
    id: "T-303",
    caseId: "SCFCA-CASE-2026-0007",
    ticketType: "reassignment_request",
    description: "Reassignment request: reassign custody case handling to another team member (PoC).",
    status: "pending_review",
    linkedDocumentIds: [],
    approvalHistory: [],
    createdBy: "alice",
    assignedTo: "bob"
  },
  {
    id: "T-201",
    caseId: "C-100",
    ticketType: "transfer_request",
    description: "Transfer 0.75 BTC to pre-approved destination (PoC request).",
    status: "awaiting_second_approval",
    linkedDocumentIds: ["DOC-77"],
    approvalHistory: [
      {
        stage: 1,
        decision: "approved",
        decidedBy: "admin01",
        decidedAt: "2026-03-19 12:10"
      }
    ],
    createdBy: "mark",
    assignedTo: "bob"
  },
  {
    id: "T-202",
    caseId: "C-101",
    ticketType: "custody_change",
    description: "Update multi-sig approver set (PoC custody change).",
    status: "approved",
    linkedDocumentIds: ["DOC-78"],
    approvalHistory: [
      {
        stage: 1,
        decision: "approved",
        decidedBy: "admin01",
        decidedAt: "2026-03-19 09:40"
      },
      {
        stage: 2,
        decision: "approved",
        decidedBy: "admin02",
        decidedAt: "2026-03-19 10:05"
      }
    ],
    createdBy: "bob",
    assignedTo: "bob"
  },
  {
    id: "T-203",
    caseId: "C-100",
    ticketType: "release_request",
    description: "Release assets from custody case upon completion (PoC).",
    status: "pending_review",
    linkedDocumentIds: [],
    approvalHistory: [],
    createdBy: "mark",
    assignedTo: "bob"
  }
];

export const demoAudit: AuditEvent[] = [
  { id: "AU-001", timestamp: "2026-03-19 10:05", actor: "auditor01", action: "Checked signature chain" },
  { id: "AU-002", timestamp: "2026-03-19 10:25", actor: "admin01", action: "Updated ticket policy" }
];

export const demoDocuments: DocumentItem[] = [
  {
    id: "DOC-FRZ-0001",
    name: "judge_freeze_order_SCFCA-CASE-2026-0001.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0001",
    createdAt: "2026-04-02",
    caseId: "SCFCA-CASE-2026-0001",
    walletRef: "WLT-1000",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0002",
    name: "judge_freeze_order_SCFCA-CASE-2026-0002.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0002",
    createdAt: "2026-04-03",
    caseId: "SCFCA-CASE-2026-0002",
    walletRef: "WLT-1001",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0003",
    name: "judge_freeze_order_SCFCA-CASE-2026-0003.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0003",
    createdAt: "2026-04-04",
    caseId: "SCFCA-CASE-2026-0003",
    walletRef: "WLT-1002",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0004",
    name: "judge_freeze_order_SCFCA-CASE-2026-0004.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0004",
    createdAt: "2026-04-05",
    caseId: "SCFCA-CASE-2026-0004",
    walletRef: "WLT-1003",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0005",
    name: "judge_freeze_order_SCFCA-CASE-2026-0005.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0005",
    createdAt: "2026-04-06",
    caseId: "SCFCA-CASE-2026-0005",
    walletRef: "WLT-1004",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0006",
    name: "judge_freeze_order_SCFCA-CASE-2026-0006.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0006",
    createdAt: "2026-04-07",
    caseId: "SCFCA-CASE-2026-0006",
    walletRef: "WLT-1005",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0007",
    name: "judge_freeze_order_SCFCA-CASE-2026-0007.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0007",
    createdAt: "2026-04-08",
    caseId: "SCFCA-CASE-2026-0007",
    walletRef: "WLT-1006",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0008",
    name: "judge_freeze_order_SCFCA-CASE-2026-0008.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0008",
    createdAt: "2026-04-09",
    caseId: "SCFCA-CASE-2026-0008",
    walletRef: "WLT-1007",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0009",
    name: "judge_freeze_order_SCFCA-CASE-2026-0009.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0009",
    createdAt: "2026-04-10",
    caseId: "SCFCA-CASE-2026-0009",
    walletRef: "WLT-1008",
    uploadedBy: "alice"
  },
  {
    id: "DOC-FRZ-0010",
    name: "judge_freeze_order_SCFCA-CASE-2026-0010.pdf",
    docType: "Judge freeze order",
    hash: "sha256:DEMO-FRZ-0010",
    createdAt: "2026-04-11",
    caseId: "SCFCA-CASE-2026-0010",
    walletRef: "WLT-1009",
    uploadedBy: "alice"
  },
  {
    id: "DOC-77",
    name: "custody_policy_v2.pdf",
    hash: "sha256:AA1BB2CC3",
    createdAt: "2026-03-18",
    caseId: "C-100",
    walletRef: "WLT-8F3A-PRIMARY",
    uploadedBy: "mark"
  },
  {
    id: "DOC-78",
    name: "audit_trace_Q1.csv",
    hash: "sha256:DD4EE5FF6",
    createdAt: "2026-03-19",
    caseId: "C-101",
    walletRef: "WLT-21C9-MSIG",
    uploadedBy: "bob"
  }
];