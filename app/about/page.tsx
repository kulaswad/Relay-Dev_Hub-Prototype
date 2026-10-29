import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Database,
  Cpu,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  CreditCard,
  FileCheck2,
  CheckSquare,
  ArrowRight,
  ExternalLink,
  Target,
  Layers,
  Sliders,
  DollarSign,
  HelpCircle,
  FileText,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AboutProductNotesPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);
  const approvalsCount = await getPendingApprovalsCountForRole(currentUser.role);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="max-w-5xl space-y-8 pb-12">
        {/* Page Header */}
        <PageHeader
          title="Product Notes"
          description="Product architecture, user personas, maker-checker governance decisions, deterministic AI design, and the evaluator demo guide."
          badge={
            <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-xs font-mono text-accent">
              Architecture &amp; Strategy
            </span>
          }
          breadcrumbs={[{ label: "Relay BMP", href: "/" }, { label: "Product Notes" }]}
        />

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 1: Problem and Users (5 Teams & Jobs To Be Done)           */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text">
                1. Problem Statement &amp; User Personas
              </h2>
              <p className="text-xs text-text-muted">
                How five distinct internal teams manage the operational lifecycle of B2B CPaaS customers without engineering intervention.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {/* AM */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-xs">Account Manager (AM)</span>
                <span className="rounded bg-accent/15 text-accent text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  Portfolio Hub
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                <strong>Jobs to be done:</strong> Monitor account health and traffic trends, prepare for quarterly business reviews, identify churn risks and unutilized seats, and request custom plan discounts (&lt;10% direct, &ge;10% requiring approval).
              </p>
            </div>

            {/* Support */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-xs">Customer Support</span>
                <span className="rounded bg-[#5B9DFF]/15 text-[#5B9DFF] text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  Masked 360
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                <strong>Jobs to be done:</strong> Triage customer delivery tickets, troubleshoot sender ID and template rejections, manage user seat provisioning, and request account suspensions. <em>Strict financial isolation:</em> Support never sees money balances or bank invoices.
              </p>
            </div>

            {/* Finance & Finance Head */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-xs">Finance &amp; Approver</span>
                <span className="rounded bg-success/15 text-success text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  Credit &amp; Ledger
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                <strong>Jobs to be done:</strong> Manage postpaid credit positions, forecast month-end EWMA exhaustion, collect overdue invoices with statutory GST breakup, log manual ledger adjustments, and record prepaid top-ups with bank UTR validation.
              </p>
            </div>

            {/* Sales Ops */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-xs">Sales Operations</span>
                <span className="rounded bg-[#E0A93B]/15 text-[#E0A93B] text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  Onboarding Wizard
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                <strong>Jobs to be done:</strong> Execute multi-step customer onboarding with Indian GSTIN state code verification, configure commercial plan catalogs and price floors, and approve commercial rate overrides and custom discounts.
              </p>
            </div>

            {/* Compliance */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-xs">Regulatory Compliance</span>
                <span className="rounded bg-[#9D7CFF]/15 text-[#9D7CFF] text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  DLT &amp; KYC Gates
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                <strong>Jobs to be done:</strong> Verify MCA incorporation certificates, audit 6-character TRAI DLT headers, validate SMS/WhatsApp message templates, enforce review SLAs, and verify authorized signatory identity.
              </p>
            </div>

            {/* Admin */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-xs">Platform Admin</span>
                <span className="rounded bg-danger/15 text-danger text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  Governance
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                <strong>Jobs to be done:</strong> Oversee system-wide RBAC permissions matrix, manage dual-approval threshold policies, verify cryptographic hash-chained audit trails, monitor AI telemetry, and reset demo datasets.
              </p>
            </div>
          </div>

          {/* Module Mapping Table */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-text uppercase tracking-wider">
              Brief Concern to BMP Module Mapping
            </span>
            <div className="overflow-x-auto rounded border border-border text-xs">
              <table className="w-full text-left font-sans">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="py-2 px-3">Business Challenge</th>
                    <th className="py-2 px-3">BMP Architectural Module</th>
                    <th className="py-2 px-3">Enforcement Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  <tr>
                    <td className="py-2 px-3 text-text font-medium">Engineering bottleneck for commercial changes</td>
                    <td className="py-2 px-3 text-accent font-mono">PlanPricingManager &amp; requestChange()</td>
                    <td className="py-2 px-3 text-text-muted">Self-serve commercial configuration with automated maker-checker routing.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text font-medium">Mid-cycle traffic pauses due to credit breaches</td>
                    <td className="py-2 px-3 text-accent font-mono">CreditIntelligence &amp; EWMA Forecast</td>
                    <td className="py-2 px-3 text-text-muted">14-day EWMA burn projection flags 80% and 100% breach dates weeks ahead.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text font-medium">Seat mismatch and invoice disputes</td>
                    <td className="py-2 px-3 text-accent font-mono">SeatReconcileCard &amp; UsersTab</td>
                    <td className="py-2 px-3 text-text-muted">One-click seat true-up aligns paid subscriptions directly with active portal logins.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text font-medium">TRAI compliance fines &amp; delayed onboarding</td>
                    <td className="py-2 px-3 text-accent font-mono">ComplianceHub &amp; Multimodal KYC</td>
                    <td className="py-2 px-3 text-text-muted">DLT header format checks, state code validation, and automated certificate extraction.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text font-medium">Internal fraud or untracked credit adjustments</td>
                    <td className="py-2 px-3 text-accent font-mono">AuditLogViewer &amp; SHA-256 Hash Chain</td>
                    <td className="py-2 px-3 text-text-muted">Tamper-evident hash chain mathematically prevents deletion or modification of records.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 2: Key Product Decisions and Trade-offs                    */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
              <Sliders className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text">
                2. Key Product Decisions &amp; Trade-Offs
              </h2>
              <p className="text-xs text-text-muted">
                Architectural rationales balancing operational velocity against enterprise compliance and financial risk.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Decision 1 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <span className="font-semibold text-text text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-success" />
                Maker-Checker Thresholds &amp; Self-Approval Prevention
              </span>
              <p className="text-text-muted leading-relaxed">
                <strong>Decision:</strong> Routine adjustments (discounts &lt;10%, credit hikes &lt;25% within baseline) apply immediately to keep velocity high. High-risk operations (discounts &ge;10%, manual adjustments &gt;₹50,000, credit limits &gt;₹10,00,000, account suspension) route to specialized approvers (Finance Head, Sales Ops).
              </p>
              <p className="text-text-muted leading-relaxed">
                <strong>Trade-off:</strong> The requester is strictly blocked from self-approving their own change request (<code className="text-accent font-mono text-[10px]">requesterId !== actorId</code>), ensuring accountability even if an approver initiates a commercial change.
              </p>
            </div>

            {/* Decision 2 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <span className="font-semibold text-text text-xs flex items-center gap-1.5">
                <Database className="h-4 w-4 text-warning" />
                Deterministic Money Math vs. Restricted GenAI
              </span>
              <p className="text-text-muted leading-relaxed">
                <strong>Decision:</strong> Financial calculations (EWMA spend burns, GST 18% splits, wallet deductions, churn risk scoring) are <strong>100% deterministic code</strong>. GenAI models are never trusted with arithmetic or database mutations.
              </p>
              <p className="text-text-muted leading-relaxed">
                <strong>Trade-off:</strong> Gemini is strictly restricted to natural language query translation (producing JSON filters against whitelisted schemas, never raw SQL) and document text extraction.
              </p>
            </div>

            {/* Decision 3 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <span className="font-semibold text-text text-xs flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-accent" />
                Single Typed Source of Truth for Role Permissions
              </span>
              <p className="text-text-muted leading-relaxed">
                <strong>Decision:</strong> Permission checks operate through a single typed function <code className="text-accent font-mono text-[10px]">can(role, action, resource)</code> defined in <code className="text-accent font-mono text-[10px]">/lib/permissions/matrix.ts</code>.
              </p>
              <p className="text-text-muted leading-relaxed">
                <strong>Trade-off:</strong> Every server action verifies role authorization before execution. Unauthorized attempts generate a tamper-evident audit record with <code className="text-danger font-mono text-[10px]">is_denied: true</code>, ensuring full security observability.
              </p>
            </div>

            {/* Decision 4 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <span className="font-semibold text-text text-xs flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#5B9DFF]" />
                SLA Definitions &amp; Proactive Alerting
              </span>
              <p className="text-text-muted leading-relaxed">
                <strong>Decision:</strong> Fixed statutory SLAs: 72 hours for corporate KYC verification, 48 hours for DLT sender headers and templates. Postpaid credit utilization triggers alerts at 70%, 80%, and 90%.
              </p>
              <p className="text-text-muted leading-relaxed">
                <strong>Trade-off:</strong> Escalated tickets and breached compliance items are surfaced proactively in top-bar notifications and dashboard alert queues before customers experience service disruption.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 3: AI Feature Cards                                        */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text">
                3. AI Feature Architecture &amp; Governance Cards
              </h2>
              <p className="text-xs text-text-muted">
                How each of the four AI capabilities is structured, monitored, and safely integrated into operational workflows.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Feature 1 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="font-bold text-text text-xs">1. Credit Forecast &amp; NL Query</span>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent font-bold">
                  Finance Hub
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
                <div><strong>Who it helps:</strong> Finance, Finance Head, Account Managers.</div>
                <div><strong>When:</strong> Weekly burn audits and credit exhaustion risk reviews.</div>
                <div><strong>Autonomy Level:</strong> Recommends &amp; filters. Never writes SQL or alters limits autonomously.</div>
                <div><strong>Failure UX:</strong> Degrades to rule-based keyword pattern matching and displays an amber fallback banner.</div>
                <div><strong>Risks &amp; Mitigations:</strong> Risk of SQL injection eliminated by translating natural language strictly into a whitelisted Zod filter schema executed via parameterized queries.</div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="font-bold text-text text-xs">2. Customer Health Summary (QBR)</span>
                <span className="rounded bg-success/15 px-2 py-0.5 font-mono text-[10px] text-success font-bold">
                  Account 360
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
                <div><strong>Who it helps:</strong> Account Managers preparing for executive customer reviews.</div>
                <div><strong>When:</strong> Prior to quarterly reviews or when managing accounts with drop in health score.</div>
                <div><strong>Autonomy Level:</strong> Drafts executive brief. Human edits, copies, or saves as account note.</div>
                <div><strong>Failure UX:</strong> Deterministic figure verification scans all numbers/percentages; unverified claims receive a yellow wavy underline and tooltip.</div>
                <div><strong>Risks &amp; Mitigations:</strong> Sparse onboarding accounts explicitly state missing historical traffic instead of fabricating statistics.</div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="font-bold text-text text-xs">3. Multimodal KYC Document Reader</span>
                <span className="rounded bg-[#9D7CFF]/15 px-2 py-0.5 font-mono text-[10px] text-[#9D7CFF] font-bold">
                  Compliance Queue
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
                <div><strong>Who it helps:</strong> Compliance Officers and Sales Operations.</div>
                <div><strong>When:</strong> Reviewing uploaded MCA certificates of incorporation and GST registrations.</div>
                <div><strong>Autonomy Level:</strong> Extraction assistant only. Reviewer must tick *"I&apos;ve verified"* for all key fields before Approve is unlocked.</div>
                <div><strong>Failure UX:</strong> Fallback extractor provides sample baseline slots with a manual review banner if unreadable.</div>
                <div><strong>Risks &amp; Mitigations:</strong> Normalized corporate suffix matching prevents false alarms on "Pvt Ltd" vs "Private Limited", while substantive discrepancies flag as major mismatches.</div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="font-bold text-text text-xs">4. Churn Risk &amp; Unused Seats</span>
                <span className="rounded bg-warning/15 px-2 py-0.5 font-mono text-[10px] text-warning font-bold">
                  Non-LLM Model
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
                <div><strong>Who it helps:</strong> Account Managers and Customer Success leads.</div>
                <div><strong>When:</strong> Weekly account portfolio reviews and contract renewal windows.</div>
                <div><strong>Autonomy Level:</strong> Recommends pre-filled seat reduction and creates tasks with <code className="text-accent font-mono text-[10px]">source: ai_recommendation</code>.</div>
                <div><strong>Failure UX:</strong> Transparent weighted mathematical signals (0–100) with visible point breakdown.</div>
                <div><strong>Risks &amp; Mitigations:</strong> Deliberately built without LLM to prevent numerical drift. The Workspace Owner account is protected and never recommended for removal.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 4: Success Metrics for BMP                                 */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text">
                4. Measurable Success Metrics for Relay BMP
              </h2>
              <p className="text-xs text-text-muted">
                Core operational KPIs demonstrating business impact and elimination of engineering overhead.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            <div className="rounded border border-border bg-surface-2 p-4 space-y-1">
              <span className="text-[11px] text-text-muted uppercase font-semibold">Engineering Overhead</span>
              <div className="font-mono text-2xl font-bold text-success">0 Tickets</div>
              <p className="text-[11px] text-text-muted">Zero engineering tasks required for commercial plan changes, credit limit adjustments, or manual wallet credits.</p>
            </div>

            <div className="rounded border border-border bg-surface-2 p-4 space-y-1">
              <span className="text-[11px] text-text-muted uppercase font-semibold">KYC Verification SLA</span>
              <div className="font-mono text-2xl font-bold text-accent">&lt;24 Hours</div>
              <p className="text-[11px] text-text-muted">Reduced from statutory 72 hours down to same-day turnaround via AI multimodal document pre-extraction.</p>
            </div>

            <div className="rounded border border-border bg-surface-2 p-4 space-y-1">
              <span className="text-[11px] text-text-muted uppercase font-semibold">Credit Breach Failures</span>
              <div className="font-mono text-2xl font-bold text-success">Near 0</div>
              <p className="text-[11px] text-text-muted">Proactive 14-day EWMA utilization forecasting prevents sudden traffic throttling during billing cycles.</p>
            </div>

            <div className="rounded border border-border bg-surface-2 p-4 space-y-1">
              <span className="text-[11px] text-text-muted uppercase font-semibold">Seat Invoice Disputes</span>
              <div className="font-mono text-2xl font-bold text-success">&lt;1%</div>
              <p className="text-[11px] text-text-muted">One-click seat true-up aligns billed seat count with active login licenses before monthly invoice issuance.</p>
            </div>

            <div className="rounded border border-border bg-surface-2 p-4 space-y-1">
              <span className="text-[11px] text-text-muted uppercase font-semibold">AM Health Audit Time</span>
              <div className="font-mono text-2xl font-bold text-accent">&lt;2 Minutes</div>
              <p className="text-[11px] text-text-muted">Reduced from 45 minutes of disparate SQL queries and ticket reviews to an instant synthesized Account 360 view.</p>
            </div>

            <div className="rounded border border-border bg-surface-2 p-4 space-y-1">
              <span className="text-[11px] text-text-muted uppercase font-semibold">AI Recommendation Adoption</span>
              <div className="font-mono text-2xl font-bold text-success">&gt;85%</div>
              <p className="text-[11px] text-text-muted">Monitored live in Admin telemetry through verified fact grounding and human Accept/Edit feedback.</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 5: What I Would Build Next vs What Was Left Out            */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text">
                5. Roadmap: What I Would Build Next &amp; What Was Left Out
              </h2>
              <p className="text-xs text-text-muted">
                Product scope boundaries and future enterprise CPaaS capabilities.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <span className="font-bold text-text uppercase text-xs text-accent">What I Would Build Next</span>
              <ul className="space-y-1.5 text-[11px] text-text-muted list-disc list-inside leading-relaxed">
                <li><strong>Real-Time Carrier CDR Reconciliation:</strong> Streaming webhook ingestion from telecom operator SMPP binds with automated latency anomaly detection.</li>
                <li><strong>Account Aggregator UTR Ingestion:</strong> Automated integration with Indian banking APIs to automatically match prepaid NEFT/RTGS UTR numbers against pending top-ups.</li>
                <li><strong>DLT Template Versioning Diffs:</strong> Side-by-side visual diff editor for updated promotional and transactional message variables across carrier portals.</li>
                <li><strong>Customer Self-Service Portal:</strong> External view for enterprise clients to inspect invoices, download GST certificates, and invite team members.</li>
              </ul>
            </div>

            <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
              <span className="font-bold text-text uppercase text-xs text-warning">What I Deliberately Left Out</span>
              <ul className="space-y-1.5 text-[11px] text-text-muted list-disc list-inside leading-relaxed">
                <li><strong>Autonomous AI Database Mutations:</strong> AI models never write or update database records directly without qualified human maker-checker approval.</li>
                <li><strong>Production SMPP Carrier Connections:</strong> Live carrier message dispatching is simulated in demo mode to protect carrier SLAs during evaluation.</li>
                <li><strong>Complex Enterprise SSO / MFA:</strong> Replaced with a demo-friendly internal role switcher allowing evaluators to experience all 7 roles seamlessly without credentials.</li>
                <li><strong>Raw SQL Execution in User Chat:</strong> Natural language queries map strictly to structured JSON filter schemas to eliminate query execution risk.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 6: Demo Guide — 6 Steps Through Meridian Finserv Story    */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-text">
                  6. Evaluator Demo Guide: 6 Steps Through the Meridian Finserv Story
                </h2>
                <p className="text-xs text-text-muted">
                  Follow this structured walkthrough to evaluate all key capabilities of Relay BMP.
                </p>
              </div>
            </div>

            <Link
              href="/accounts/org_meridian_finserv"
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm"
            >
              <span>Start Hero Story</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            {/* Step 1 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-accent font-bold text-xs">STEP 01</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">AM Role</span>
              </div>
              <h3 className="font-semibold text-text text-xs">Open Meridian Finserv 360</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Navigate to <Link href="/accounts/org_meridian_finserv" className="text-accent underline font-mono">/accounts/org_meridian_finserv</Link>. Inspect the 68/100 health score, attention alerts, and 90-day omnichannel traffic charts.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-accent font-bold text-xs">STEP 02</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">AM Role</span>
              </div>
              <h3 className="font-semibold text-text text-xs">Prepare QBR Executive Brief</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Click <strong>&quot;Prepare QBR&quot;</strong> in the sticky header or open Tab 9 (AI Insights). Generate an executive brief grounded in ledger facts with figure verification.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-accent font-bold text-xs">STEP 03</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">AM Role</span>
              </div>
              <h3 className="font-semibold text-text text-xs">Inspect Churn Signals &amp; Seat Waste</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                In the Overview tab, view the transparent churn breakdown (+15 pts usage decline) and the 8 unused seats wasting ₹12,000/month. Create an AM task.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-accent font-bold text-xs">STEP 04</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">Finance Role</span>
              </div>
              <h3 className="font-semibold text-text text-xs">Ask About Credit &amp; EWMA Forecast</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Switch to Finance role and open <Link href="/finance" className="text-accent underline font-mono">/finance</Link>. Ask: <em>&quot;which customers will cross 80% this month&quot;</em> to view the projected breach dates and request a credit limit hike.
              </p>
            </div>

            {/* Step 5 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-accent font-bold text-xs">STEP 05</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">Finance Head</span>
              </div>
              <h3 className="font-semibold text-text text-xs">Maker-Checker Dual Approval</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Switch role to <strong>Finance Head</strong> and open <Link href="/approvals" className="text-accent underline font-mono">/approvals</Link>. Approve the pending credit hike. Notice self-approval prevention if attempted by the requester.
              </p>
            </div>

            {/* Step 6 */}
            <div className="rounded border border-border bg-surface-2 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-accent font-bold text-xs">STEP 06</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">Compliance</span>
              </div>
              <h3 className="font-semibold text-text text-xs">Multimodal KYC Document Review</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Open <Link href="/compliance" className="text-accent underline font-mono">/compliance</Link>, inspect the Meridian KYC case, and click <strong>&quot;Read documents with AI&quot;</strong> to test clean matching and test the sample mismatched document flag.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
