'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import legislativeData from '@/data/legislative-data';
import { cn, formatDate, getPartyColor, getBillTypeLabel } from '@/lib/utils';
import { getPassageProbability } from '@/lib/fiscal-utils';
import { STATUS_LABELS } from '@/types';
import type { Topic } from '@/types';
import { FiscalSummaryCard, FiscalDetailModal } from '@/components/fiscal';
import { BillChatSidebar, ChatToggleButton, VersionDiffModal } from '@/components/chat';
import {
  FileText,
  User,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  GitCompare,
  Tag,
} from 'lucide-react';

// Helper to get topic info for badges
function getTopicBadges(topicIds: string[] | undefined): Topic[] {
  if (!topicIds || topicIds.length === 0) return [];
  return topicIds
    .map((id) => legislativeData.getTopicById(id))
    .filter((t): t is Topic => t !== null);
}

interface BillPageProps {
  params: Promise<{ slug: string }>;
}

export default function BillPage({ params }: BillPageProps) {
  const { slug } = use(params);
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  // Convert slug (e.g., "sb-834") to bill number (e.g., "SB 834")
  const billNumber = slug.toUpperCase().replace('-', ' ');

  const bill = useMemo(() => {
    return legislativeData.getBillByNumber(billNumber);
  }, [billNumber]);

  if (!bill) {
    notFound();
  }

  const sponsor = legislativeData.getSponsorForBill(bill.id);
  const coSponsors = legislativeData.getCoSponsorsForBill(bill.id);
  const actions = legislativeData.getActionsForBill(bill.id);
  const summary = legislativeData.getSummaryForBill(bill.id);
  const fiscalNote = legislativeData.getFiscalNoteForBill(bill.id);
  const billVersions = legislativeData.getBillVersionsForBill(bill.id);
  const passageProbability = getPassageProbability(bill.currentStatus);
  const committee = bill.currentCommittee
    ? legislativeData.getCommitteeById(bill.currentCommittee)
    : null;
  const hearings = legislativeData.getHearingsForBill(bill.id);

  const chamberColor = bill.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/bills"
          className="inline-flex items-center text-mo-blue hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Bills
        </Link>
      </nav>

      {/* Bill Header */}
      <div className={cn('rounded-t-xl p-6 text-white', chamberColor)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-bold">
                {bill.billNumber}
              </span>
              <span className="text-sm opacity-80">
                {getBillTypeLabel(bill.billPrefix)}
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-2">{bill.title}</h1>
            <p className="text-white/80">{bill.briefDescription}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-white text-mo-navy rounded-full text-sm font-medium">
              {STATUS_LABELS[bill.currentStatus] || bill.currentStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gray-100 border-x border-b border-gray-200 rounded-b-xl p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Introduced</p>
            <p className="font-semibold">{formatDate(bill.introducedDate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Last Action</p>
            <p className="font-semibold">{formatDate(bill.lastActionDate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Effective Date</p>
            <p className="font-semibold">{formatDate(bill.effectiveDate)}</p>
          </div>
          <div>
            <p className="text-gray-500">LR Number</p>
            <p className="font-semibold">{bill.lrNumber}</p>
          </div>
        </div>
      </div>

      {/* Topic Badges */}
      {bill.topics && bill.topics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Topics</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {getTopicBadges(bill.topics).map((topic) => (
              <Link
                key={topic.id}
                href={`/bills?topic=${topic.id.replace('topic:', '')}`}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105',
                  topic.color
                )}
                title={topic.description}
              >
                {topic.icon} {topic.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Section */}
          {summary && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Summary
              </h2>

              {summary.plainLanguage && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-mo-blue mb-2">
                    Plain Language
                  </h3>
                  <p className="text-gray-700 bg-mo-cream p-4 rounded-lg">
                    {summary.plainLanguage}
                  </p>
                </div>
              )}

              {summary.technicalSummary && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    Technical Summary
                  </h3>
                  <p className="text-gray-600">{summary.technicalSummary}</p>
                </div>
              )}

              {summary.keyProvisions && summary.keyProvisions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    Key Provisions
                  </h3>
                  <ul className="space-y-2">
                    {summary.keyProvisions.map((provision, index) => (
                      <li key={index} className="flex items-start text-gray-600">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                        {provision}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Action History */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Action History
            </h2>

            {actions.length === 0 ? (
              <p className="text-gray-500">No actions recorded yet.</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                <div className="space-y-4">
                  {actions.map((action, index) => (
                    <div key={action.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute left-2.5 w-3 h-3 rounded-full border-2 border-white',
                          action.isKeyMilestone ? 'bg-mo-gold' : 'bg-gray-400'
                        )}
                      />

                      <div
                        className={cn(
                          'p-3 rounded-lg',
                          action.isKeyMilestone ? 'bg-mo-gold/10' : 'bg-gray-50'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {action.actionDescription}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(action.actionDate)}
                              {action.journalPage && (
                                <span className="ml-2">
                                  Journal Page: {action.journalPage}
                                </span>
                              )}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs text-white',
                              action.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue'
                            )}
                          >
                            {action.chamber}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fiscal Impact */}
          {fiscalNote && (
            <FiscalSummaryCard
              fiscalNote={fiscalNote}
              passageProbability={passageProbability}
              onViewDetails={() => setFiscalModalOpen(true)}
            />
          )}

          {/* Sponsor */}
          {sponsor && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Primary Sponsor
              </h3>
              <Link
                href={`/members/${sponsor.chamber}-${sponsor.district}`}
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mr-3',
                    getPartyColor(sponsor.party)
                  )}
                >
                  {sponsor.firstName[0]}
                  {sponsor.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{sponsor.fullName}</p>
                  <p className="text-sm text-gray-500">
                    {sponsor.title} - District {sponsor.district}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
              </Link>

              {coSponsors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-2">
                    Co-Sponsors ({coSponsors.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coSponsors.map((coSponsor) => (
                      <Link
                        key={coSponsor.id}
                        href={`/members/${coSponsor.chamber}-${coSponsor.district}`}
                        className={cn(
                          'px-2 py-1 rounded-full text-xs text-white',
                          getPartyColor(coSponsor.party)
                        )}
                      >
                        {coSponsor.lastName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Committee */}
          {committee && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Building2 className="w-4 h-4 mr-2" />
                Current Committee
              </h3>
              <Link
                href={`/committees/${committee.id.split(':').pop()}`}
                className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <p className="font-medium text-gray-900">{committee.name}</p>
                <p className="text-sm text-gray-500 capitalize">
                  {committee.chamber} {committee.type}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {committee.meetingSchedule}
                </p>
              </Link>
            </section>
          )}

          {/* Upcoming Hearings */}
          {hearings.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Scheduled Hearings
              </h3>
              <div className="space-y-3">
                {hearings.map((hearing) => (
                  <div
                    key={hearing.id}
                    className="p-3 rounded-lg bg-mo-gold/10 border border-mo-gold/30"
                  >
                    <p className="font-medium text-gray-900">
                      {formatDate(hearing.hearingDate)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {hearing.hearingTime} - {hearing.room}
                    </p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-mo-gold text-mo-navy capitalize">
                      {hearing.type} hearing
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Analysis Tools */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2" />
              AI Analysis
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setChatOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Ask about this bill
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
              {billVersions.length >= 2 && (
                <button
                  onClick={() => setDiffModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4" />
                    Compare versions
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>

          {/* External Links */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <ExternalLink className="w-4 h-4 mr-2" />
              Official Resources
            </h3>
            <div className="space-y-2">
              <a
                href={
                  bill.chamber === 'senate'
                    ? bill.senateBillId
                      ? `https://www.senate.mo.gov/26info/BTS_Web/Bill.aspx?SessionType=R&BillID=${bill.senateBillId}`
                      : `https://www.senate.mo.gov/BillTracking/Bills/BillSearch/?year=2026&session=R&BillPrefix=${bill.billPrefix}&BillSuffix=${bill.billSuffix}`
                    : `https://www.house.mo.gov/Bill.aspx?bill=${bill.billPrefix}${bill.billSuffix}&year=2026&code=R`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm text-mo-blue"
              >
                Official Bill Page
                <ExternalLink className="w-4 h-4" />
              </a>
              {billVersions.length > 0 ? (
                billVersions.map((version) => (
                  <a
                    key={version.id}
                    href={version.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm text-mo-blue"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {version.versionLabel} (PDF)
                    </span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ))
              ) : (
                <a
                  href={
                    bill.chamber === 'senate'
                      ? `https://www.senate.mo.gov/26info/pdf-bill/intro/${bill.billPrefix}${bill.billSuffix}.pdf`
                      : `https://documents.house.mo.gov/billtracking/bills261/hlrbillspdf/${bill.lrNumber}.pdf`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm text-mo-blue"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    View Full Text (PDF)
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {fiscalNote?.pdfUrl && (
                <a
                  href={fiscalNote.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm text-mo-blue"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Fiscal Note
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Fiscal Detail Modal */}
      {fiscalNote && (
        <FiscalDetailModal
          fiscalNote={fiscalNote}
          bill={bill}
          passageProbability={passageProbability}
          isOpen={fiscalModalOpen}
          onClose={() => setFiscalModalOpen(false)}
        />
      )}

      {/* AI Chat Sidebar */}
      <BillChatSidebar
        billId={bill.id}
        billNumber={bill.billNumber}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Chat Toggle Button */}
      <ChatToggleButton
        onClick={() => setChatOpen(!chatOpen)}
        isOpen={chatOpen}
      />

      {/* Version Diff Modal */}
      <VersionDiffModal
        billId={bill.id}
        billNumber={bill.billNumber}
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
      />
    </div>
  );
}
