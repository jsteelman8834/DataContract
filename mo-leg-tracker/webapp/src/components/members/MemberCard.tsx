'use client';

import Link from 'next/link';
import { cn, getPartyColor, getPartyBorderColor } from '@/lib/utils';
import type { Member, MemberWithRole } from '@/types';
import { User, Mail, Phone, MapPin } from 'lucide-react';

interface MemberCardProps {
  member: Member | MemberWithRole;
  showRole?: boolean;
  compact?: boolean;
}

export function MemberCard({ member, showRole = false, compact = false }: MemberCardProps) {
  const role = 'role' in member ? member.role : null;

  if (compact) {
    return (
      <Link href={`/members/${member.chamber}-${member.district}`}>
        <div className={cn(
          'flex items-center p-2 rounded-lg border hover:shadow-md transition-shadow cursor-pointer',
          getPartyBorderColor(member.party)
        )}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-2',
            getPartyColor(member.party)
          )}>
            {member.firstName[0]}{member.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {member.fullName}
            </p>
            <p className="text-xs text-gray-500">
              {member.title} - District {member.district}
            </p>
          </div>
          {showRole && role && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 capitalize">
              {role.replace('_', ' ')}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/members/${member.chamber}-${member.district}`}>
      <div className={cn(
        'bg-white rounded-lg border-2 p-4 hover:shadow-lg transition-shadow cursor-pointer',
        getPartyBorderColor(member.party)
      )}>
        <div className="flex items-start gap-4">
          {/* Photo or Initials */}
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold',
              getPartyColor(member.party)
            )}>
              {member.firstName[0]}{member.lastName[0]}
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-bold text-white',
                getPartyColor(member.party)
              )}>
                {member.party}
              </span>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs text-white',
                member.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue'
              )}>
                {member.chamber === 'senate' ? 'Senate' : 'House'}
              </span>
              {showRole && role && role !== 'member' && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-mo-gold text-mo-navy capitalize">
                  {role.replace('_', ' ')}
                </span>
              )}
            </div>

            <h3 className="font-bold text-lg text-gray-900">
              {member.fullName}
            </h3>
            <p className="text-sm text-gray-600 flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              District {member.district}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center text-sm text-gray-600 hover:text-mo-blue"
            >
              <Mail className="w-4 h-4 mr-2" />
              {member.email}
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center text-sm text-gray-600 hover:text-mo-blue"
            >
              <Phone className="w-4 h-4 mr-2" />
              {member.phone}
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

interface MemberListProps {
  members: (Member | MemberWithRole)[];
  compact?: boolean;
  showRole?: boolean;
}

export function MemberList({ members, compact = false, showRole = false }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No members found</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} compact showRole={showRole} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {members.map((member) => (
        <MemberCard key={member.id} member={member} showRole={showRole} />
      ))}
    </div>
  );
}
