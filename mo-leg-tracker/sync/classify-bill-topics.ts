/**
 * Topic Classification Script for Missouri Legislative Tracker
 *
 * Classifies bills into citizen-friendly topic categories based on
 * keywords matched in bill titles and descriptions.
 *
 * Run with: npx ts-node classify-bill-topics.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const GRAPH_PATH = path.join(__dirname, '../webapp/db/graph.json');
const MAX_TOPICS_PER_BILL = 3;

// Topic definitions with keywords for classification
interface TopicDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  keywords: string[];
  color: string;
}

const TOPICS: TopicDefinition[] = [
  {
    id: 'taxes',
    name: 'Taxes & Budget',
    icon: '💰',
    description: 'Property tax, income tax, sales tax, state budget, and fees',
    keywords: [
      'tax', 'appropriat', 'budget', 'revenue', 'assessment', 'fee', 'levy',
      'fiscal', 'treasury', 'refund', 'credit', 'deduction', 'exempt',
      'income tax', 'sales tax', 'property tax', 'gasoline tax', 'motor fuel',
      'withholding', 'taxpayer', 'taxable'
    ],
    color: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'health',
    name: 'Health & Healthcare',
    icon: '🏥',
    description: 'Insurance coverage, hospitals, mental health, public health, and drugs',
    keywords: [
      'health', 'medical', 'hospital', 'insurance', 'mental', 'drug', 'opioid',
      'vaccine', 'medicaid', 'medicare', 'physician', 'doctor', 'nurse',
      'pharmacy', 'prescription', 'patient', 'treatment', 'therapy', 'disease',
      'abortion', 'reproductive', 'dental', 'healthcare', 'clinic'
    ],
    color: 'bg-red-100 text-red-800',
  },
  {
    id: 'education',
    name: 'Education',
    icon: '🎓',
    description: 'K-12 schools, higher education, school safety, teachers, and curriculum',
    keywords: [
      'school', 'education', 'student', 'teacher', 'university', 'college',
      'curriculum', 'tuition', 'scholarship', 'charter', 'superintendent',
      'classroom', 'instruction', 'academic', 'elementary', 'secondary',
      'higher education', 'kindergarten', 'principal', 'diploma', 'graduate',
      'library', 'literacy', 'vocational'
    ],
    color: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'justice',
    name: 'Crime & Justice',
    icon: '⚖️',
    description: 'Criminal law, sentencing, courts, corrections, and victims',
    keywords: [
      'crime', 'criminal', 'sentenc', 'court', 'prison', 'offens', 'victim',
      'prosecut', 'felony', 'misdemeanor', 'jail', 'parole', 'probation',
      'judge', 'jury', 'attorney', 'lawyer', 'conviction', 'assault',
      'theft', 'murder', 'robbery', 'burglary', 'fraud', 'penalty',
      'incarcerat', 'corrections', 'defendant'
    ],
    color: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'guns',
    name: 'Guns & Firearms',
    icon: '🔫',
    description: 'Firearms, ammunition, concealed carry, and Second Amendment',
    keywords: [
      'firearm', 'gun', 'weapon', 'ammunition', 'concealed carry', 'self-defense',
      'second amendment', 'handgun', 'rifle', 'shotgun', 'pistol', 'open carry',
      'permit to carry', 'nfa', 'atf', 'silencer', 'suppressor', 'magazine'
    ],
    color: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'safety',
    name: 'Public Safety',
    icon: '🚨',
    description: 'Police, fire, emergency services, and first responders',
    keywords: [
      'police', 'sheriff', 'fire department', 'emergency', 'public safety',
      'law enforcement', 'officer', 'deputy', 'constable', 'patrol', 'ems',
      'paramedic', 'first responder', '911', 'disaster', 'firefighter',
      'rescue', 'ambulance', 'emergency management', 'homeland security'
    ],
    color: 'bg-red-100 text-red-800',
  },
  {
    id: 'housing',
    name: 'Housing & Property',
    icon: '🏠',
    description: 'Real estate, homeowners, landlords, and property rights',
    keywords: [
      'property', 'home', 'house', 'housing', 'real estate', 'landlord',
      'tenant', 'hoa', 'homeowner', 'mortgage', 'rent', 'lease', 'evict',
      'foreclosure', 'deed', 'title', 'zoning', 'condominium', 'apartment',
      'residential', 'dwelling', 'manufactured home', 'mobile home'
    ],
    color: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'jobs',
    name: 'Jobs & Business',
    icon: '👷',
    description: 'Employment, workers comp, labor, and business regulations',
    keywords: [
      'employ', 'worker', 'wage', 'labor', 'business', 'license', 'occupation',
      'minimum wage', 'unemployment', 'workforce', 'compensation', 'overtime',
      'workplace', 'employer', 'hiring', 'termination', 'union', 'collective',
      'professional', 'contractor', 'corporation', 'llc', 'small business',
      'entrepreneurship', 'commerce'
    ],
    color: 'bg-yellow-100 text-yellow-800',
  },
  {
    id: 'transportation',
    name: 'Transportation',
    icon: '🚗',
    description: 'Vehicles, roads, drivers licenses, and public transit',
    keywords: [
      'vehicle', 'motor', 'driver', 'road', 'highway', 'transport', 'traffic',
      'license', 'registration', 'automobile', 'truck', 'motorcycle', 'bridge',
      'transit', 'railroad', 'aviation', 'airport', 'dmv', 'modot',
      'infrastructure', 'pavement', 'speed limit', 'parking'
    ],
    color: 'bg-slate-100 text-slate-800',
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Environment',
    icon: '🌾',
    description: 'Farming, natural resources, conservation, and wildlife',
    keywords: [
      'agricult', 'farm', 'livestock', 'environment', 'conservation', 'water',
      'wildlife', 'fishing', 'hunting', 'crop', 'cattle', 'poultry', 'dairy',
      'soil', 'pollution', 'clean water', 'air quality', 'pesticide',
      'fertilizer', 'forestry', 'timber', 'natural resource', 'park',
      'recreation', 'dnr', 'epa', 'climate'
    ],
    color: 'bg-green-100 text-green-800',
  },
  {
    id: 'voting',
    name: 'Voting & Government',
    icon: '🗳️',
    description: 'Elections, voting, local government, and state agencies',
    keywords: [
      'elect', 'vote', 'ballot', 'government', 'county', 'municipal',
      'public official', 'campaign', 'candidate', 'primary', 'general election',
      'absentee', 'poll', 'precinct', 'redistrict', 'legislat', 'governor',
      'secretary of state', 'state agency', 'township', 'city council',
      'alderman', 'mayor', 'political', 'partisan'
    ],
    color: 'bg-indigo-100 text-indigo-800',
  },
  {
    id: 'families',
    name: 'Families & Seniors',
    icon: '👨‍👩‍👧',
    description: 'Child welfare, adoption, parental rights, and aging',
    keywords: [
      'child', 'family', 'parent', 'adopt', 'senior', 'elder', 'juvenile',
      'custody', 'foster', 'guardian', 'minor', 'abuse', 'neglect', 'welfare',
      'domestic', 'marriage', 'divorce', 'infant', 'newborn', 'daycare',
      'childcare', 'retirement', 'nursing home', 'assisted living',
      'grandparent', 'aging', 'social services', 'dss', 'dcfs'
    ],
    color: 'bg-pink-100 text-pink-800',
  },
  {
    id: 'rights',
    name: 'Rights & Technology',
    icon: '🔒',
    description: 'Civil liberties, religious freedom, privacy, AI, and internet',
    keywords: [
      'right', 'freedom', 'religious', 'privacy', 'data', 'artificial intelligence',
      'ai', 'internet', 'social media', 'cybersecurity', 'discrimination',
      'civil right', 'free speech', 'first amendment', 'constitutional',
      'liberty', 'lgbtq', 'gender', 'disability', 'accessibility', 'ada',
      'surveillance', 'encryption', 'technology', 'digital', 'online'
    ],
    color: 'bg-cyan-100 text-cyan-800',
  },
];

// Committee name to topic mapping for secondary classification signal
const COMMITTEE_TOPIC_MAP: Record<string, string[]> = {
  // House committees
  'health_and_mental_health': ['health'],
  'health_and_mental_health_policy': ['health'],
  'ways_and_means': ['taxes'],
  'budget': ['taxes'],
  'appropriations_education': ['education', 'taxes'],
  'appropriations_general_administration': ['taxes'],
  'appropriations_health_mental_health_and_social_services': ['taxes', 'health'],
  'appropriations_public_safety_and_corrections': ['taxes', 'justice'],
  'appropriations_revenue_transportation_and_economic_development': ['taxes', 'transportation', 'jobs'],
  'education': ['education'],
  'elementary_and_secondary_education': ['education'],
  'higher_education': ['education'],
  'judiciary': ['justice'],
  'crime_prevention': ['justice'],
  'corrections_and_public_institutions': ['justice'],
  'agriculture_policy': ['agriculture'],
  'conservation_and_natural_resources': ['agriculture'],
  'transportation': ['transportation'],
  'transportation_accountability': ['transportation'],
  'local_government': ['voting'],
  'elections_and_elected_officials': ['voting'],
  'commerce': ['jobs'],
  'economic_development': ['jobs'],
  'workforce_development': ['jobs'],
  'insurance_policy': ['health', 'jobs'],
  'professional_registration_and_licensing': ['jobs'],
  'children_and_families': ['families'],
  'seniors_families_children_and_persons_with_disabilities': ['families'],
  'veterans': ['families'],
  'rules_administrative_oversight': ['voting'],
  'rules_legislative_oversight': ['voting'],
  'general_laws': ['rights'],
  'special_committee_on_government_accountability': ['voting'],
  'special_committee_on_small_business': ['jobs'],
  'emerging_issues': ['rights'],
  'public_safety': ['safety'],
  'firearms': ['guns'],

  // Senate committees
  'insurance_and_banking': ['jobs', 'housing'],
  'judiciary_and_civil_and_criminal_jurisprudence': ['justice'],
  'agriculture_food_production_and_outdoor_resources': ['agriculture'],
  'senate_economic_development': ['jobs'],
  'education_and_workforce_development': ['education', 'jobs'],
  'governmental_accountability': ['voting'],
  'health_and_welfare': ['health', 'families'],
  'local_government_elections_and_pensions': ['voting'],
  'transportation_infrastructure_and_public_safety': ['transportation', 'safety'],
  'ways_and_means_and_fiscal_oversight': ['taxes'],
};

interface Bill {
  id: string;
  billNumber: string;
  title: string;
  briefDescription: string;
  currentCommittee: string | null;
  topics?: string[];
}

interface GraphDatabase {
  _meta: {
    version: string;
    updated: string;
  };
  nodes: {
    bills: Record<string, Bill>;
    topics?: Record<string, TopicDefinition>;
    [key: string]: unknown;
  };
  edges: Record<string, unknown[]>;
}

function classifyBill(bill: Bill): string[] {
  const scores: Map<string, number> = new Map();

  // Combine title and description for matching (lowercase)
  const text = `${bill.title} ${bill.briefDescription}`.toLowerCase();

  // Score each topic based on keyword matches
  for (const topic of TOPICS) {
    let score = 0;

    for (const keyword of topic.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Count occurrences (partial match for stemming like "tax" matching "taxes")
      const regex = new RegExp(keywordLower, 'gi');
      const matches = text.match(regex);
      if (matches) {
        // Weight multi-word keywords higher
        const weight = keyword.includes(' ') ? 2 : 1;
        score += matches.length * weight;
      }
    }

    if (score > 0) {
      scores.set(topic.id, score);
    }
  }

  // Boost score based on committee assignment
  if (bill.currentCommittee) {
    // Extract committee slug from ID like "committee:house:health_and_mental_health"
    const parts = bill.currentCommittee.split(':');
    const committeeSlug = parts[parts.length - 1];

    const committeeTopics = COMMITTEE_TOPIC_MAP[committeeSlug];
    if (committeeTopics) {
      for (const topicId of committeeTopics) {
        const currentScore = scores.get(topicId) || 0;
        // Add a boost of 3 for committee match
        scores.set(topicId, currentScore + 3);
      }
    }
  }

  // Sort by score and take top N
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOPICS_PER_BILL)
    .filter(([, score]) => score >= 1) // Only include if score >= 1
    .map(([topicId]) => topicId);

  return sorted;
}

function main() {
  console.log('Loading graph database...');
  const data: GraphDatabase = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

  // Add topics to nodes if not present
  if (!data.nodes.topics) {
    console.log('Adding topic definitions to graph...');
    data.nodes.topics = {};
  }

  // Add all topic definitions
  for (const topic of TOPICS) {
    data.nodes.topics[`topic:${topic.id}`] = {
      ...topic,
      id: `topic:${topic.id}`,
    };
  }

  // Count stats
  const stats = {
    total: 0,
    classified: 0,
    byTopic: new Map<string, number>(),
    topicCounts: [] as number[],
  };

  // Initialize topic counts
  for (const topic of TOPICS) {
    stats.byTopic.set(topic.id, 0);
  }

  // Classify each bill
  console.log('\nClassifying bills...');
  for (const bill of Object.values(data.nodes.bills)) {
    stats.total++;

    const topics = classifyBill(bill);
    bill.topics = topics;

    if (topics.length > 0) {
      stats.classified++;
      stats.topicCounts.push(topics.length);

      for (const topicId of topics) {
        stats.byTopic.set(topicId, (stats.byTopic.get(topicId) || 0) + 1);
      }
    }
  }

  // Print statistics
  console.log('\n=== Classification Results ===');
  console.log(`Total bills: ${stats.total}`);
  console.log(`Bills with topics: ${stats.classified} (${((stats.classified / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Average topics per bill: ${(stats.topicCounts.reduce((a, b) => a + b, 0) / stats.topicCounts.length).toFixed(2)}`);

  console.log('\nBills by Topic:');
  const sortedTopics = Array.from(stats.byTopic.entries())
    .sort((a, b) => b[1] - a[1]);

  for (const [topicId, count] of sortedTopics) {
    const topic = TOPICS.find(t => t.id === topicId)!;
    const pct = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${topic.icon} ${topic.name}: ${count} (${pct}%)`);
  }

  // Update metadata
  data._meta.updated = new Date().toISOString();

  // Save updated graph
  console.log('\nSaving updated graph...');
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(data, null, 2));
  console.log('Done!');
}

main();
