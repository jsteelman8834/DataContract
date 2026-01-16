'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import legislativeData from '@/data/legislative-data';
import { cn, formatDate, getPartyColor, getPartyBorderColor } from '@/lib/utils';
import { BillCard } from '@/components/bills/BillCard';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  ArrowLeft,
  ExternalLink,
  Calendar,
} from 'lucide-react';

interface MemberPageProps {
  params: Promise<{ id: string }>;
}

export default function MemberPage({ params }: MemberPageProps) {
  const { id } = use(params);

  // Parse id format: "senate-28" or "house-001"
  const [chamber, district] = id.split('-');

  const member = useMemo(() => {
    const members = legislativeData.getAllMembers();
    return members.find(
      (m) =>
        m.chamber === chamber &&
        (m.district === district || m.district === district.padStart(3, '0'))
    );
  }, [chamber, district]);

  if (!member) {
    notFound();
  }

  const sponsoredBills = legislativeData
    .getBillsForSponsor(member.id)
    .map((bill) => legislativeData.getBillCard(bill));

  const committees = legislativeData.getCommitteesForMember(member.id);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/members"
          className="inline-flex items-center text-mo-blue hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Legislators
        </Link>
      </nav>

      {/* Member Header */}
      <div className={cn('rounded-xl overflow-hidden mb-6', getPartyBorderColor(member.party), 'border-4')}>
        <div
          className={cn(
            'p-6 text-white',
            member.party === 'R' ? 'bg-mo-red' : member.party === 'D' ? 'bg-mo-blue' : 'bg-mo-gold'
          )}
        >
          <div className="flex items-start gap-6">
            {/* Photo */}
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.fullName}
                className="w-32 h-32 rounded-full object-cover border-4 border-white/50"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold border-4 border-white/50">
                {member.firstName[0]}
                {member.lastName[0]}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-bold uppercase">
                  {member.party === 'R' ? 'Republican' : member.party === 'D' ? 'Democrat' : 'Independent'}
                </span>
                <span className={cn(
                  'px-3 py-1 rounded-lg text-sm',
                  member.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue'
                )}>
                  {member.chamber === 'senate' ? 'Senate' : 'House'}
                </span>
              </div>

              <h1 className="text-3xl font-bold mb-1">{member.fullName}</h1>
              <p className="text-white/80 text-lg">
                {member.title} - District {member.district}
              </p>

              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 opacity-80" />
                  Term: {formatDate(member.termStart)} - {formatDate(member.termEnd)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Bar */}
        <div className="bg-gray-100 p-4 flex flex-wrap gap-6">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="flex items-center text-gray-700 hover:text-mo-blue"
            >
              <Mail className="w-5 h-5 mr-2" />
              {member.email}
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="flex items-center text-gray-700 hover:text-mo-blue"
            >
              <Phone className="w-5 h-5 mr-2" />
              {member.phone}
            </a>
          )}
          <a
            href={`https://www.${member.chamber}.mo.gov/member/${member.district}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-mo-blue hover:underline ml-auto"
          >
            Official Page <ExternalLink className="w-4 h-4 ml-1" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sponsored Bills */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Sponsored Bills ({sponsoredBills.length})
            </h2>

            {sponsoredBills.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                No bills sponsored yet this session
              </p>
            ) : (
              <div className="space-y-3">
                {sponsoredBills.map((billCard) => (
                  <BillCard key={billCard.bill.id} billCard={billCard} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Committee Assignments */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Committee Assignments
            </h3>

            {committees.length === 0 ? (
              <p className="text-gray-500 text-sm">No committee assignments</p>
            ) : (
              <div className="space-y-3">
                {committees.map(({ committee, role }) => (
                  <Link
                    key={committee.id}
                    href={`/committees/${committee.id.split(':').pop()}`}
                    className={cn(
                      'block p-3 rounded-lg border transition-colors hover:shadow-md',
                      role === 'chair' ? 'border-mo-gold bg-mo-gold/10' : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <p className="font-medium text-gray-900">{committee.name}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {role.replace('_', ' ')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Quick Stats */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Session Activity</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Bills Sponsored</span>
                <span className="font-bold text-mo-navy">{sponsoredBills.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Committee Seats</span>
                <span className="font-bold text-mo-navy">{committees.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Chair Positions</span>
                <span className="font-bold text-mo-gold-dark">
                  {committees.filter((c) => c.role === 'chair').length}
                </span>
              </div>
            </div>
          </section>

          {/* District Info */}
          <section className="bg-mo-cream rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              District {member.district}
            </h3>
            <p className="text-sm text-gray-600">
              {member.chamber === 'senate'
                ? 'Senate districts cover larger geographic areas and have 4-year terms.'
                : 'House districts are smaller and have 2-year terms.'}
            </p>
            <a
              href={`https://www.house.mo.gov/map.aspx`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-3 text-sm text-mo-blue hover:underline"
            >
              View District Map <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
