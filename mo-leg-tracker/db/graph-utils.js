/**
 * Missouri Legislative Graph Database Utilities
 *
 * Helper functions for querying and manipulating the JSON graph database.
 * Can be used in Node.js or browser environments.
 */

class LegislativeGraph {
  constructor(graphData) {
    this.data = graphData;
    this.nodes = graphData.nodes;
    this.edges = graphData.edges;
    this.indexes = graphData._indexes || {};
  }

  // ============================================================
  // NODE OPERATIONS
  // ============================================================

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    for (const nodeType of Object.keys(this.nodes)) {
      if (this.nodes[nodeType][nodeId]) {
        return { type: nodeType, ...this.nodes[nodeType][nodeId] };
      }
    }
    return null;
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(nodeType) {
    return Object.values(this.nodes[nodeType] || {});
  }

  /**
   * Get a bill by bill number (e.g., "SB 834")
   */
  getBillByNumber(billNumber) {
    const billId = this.indexes.billsByNumber?.[billNumber];
    return billId ? this.nodes.bills[billId] : null;
  }

  /**
   * Get all bills with a specific status
   */
  getBillsByStatus(status) {
    const billIds = this.indexes.billsByStatus?.[status] || [];
    return billIds.map(id => this.nodes.bills[id]).filter(Boolean);
  }

  /**
   * Get all bills assigned to a committee
   */
  getBillsByCommittee(committeeId) {
    const billIds = this.indexes.billsByCommittee?.[committeeId] || [];
    return billIds.map(id => this.nodes.bills[id]).filter(Boolean);
  }

  /**
   * Get a member by district
   */
  getMemberByDistrict(chamber, district) {
    const key = `${chamber}:${district}`;
    const memberId = this.indexes.membersByDistrict?.[key];
    return memberId ? this.nodes.members[memberId] : null;
  }

  // ============================================================
  // EDGE / RELATIONSHIP OPERATIONS
  // ============================================================

  /**
   * Get all edges of a specific type
   */
  getEdgesByType(edgeType) {
    return this.edges[edgeType] || [];
  }

  /**
   * Get all outgoing edges from a node
   */
  getOutgoingEdges(nodeId) {
    const result = [];
    for (const [edgeType, edges] of Object.entries(this.edges)) {
      for (const edge of edges) {
        if (edge.from === nodeId) {
          result.push({ type: edgeType, ...edge });
        }
      }
    }
    return result;
  }

  /**
   * Get all incoming edges to a node
   */
  getIncomingEdges(nodeId) {
    const result = [];
    for (const [edgeType, edges] of Object.entries(this.edges)) {
      for (const edge of edges) {
        if (edge.to === nodeId) {
          result.push({ type: edgeType, ...edge });
        }
      }
    }
    return result;
  }

  /**
   * Get connected nodes via a specific edge type
   */
  traverse(nodeId, edgeType, direction = 'outgoing') {
    const edges = direction === 'outgoing'
      ? this.getOutgoingEdges(nodeId).filter(e => e.type === edgeType)
      : this.getIncomingEdges(nodeId).filter(e => e.type === edgeType);

    return edges.map(edge => {
      const targetId = direction === 'outgoing' ? edge.to : edge.from;
      return this.getNode(targetId);
    }).filter(Boolean);
  }

  // ============================================================
  // BILL-SPECIFIC QUERIES
  // ============================================================

  /**
   * Get the sponsor(s) of a bill
   */
  getBillSponsors(billId) {
    const primary = this.traverse(billId, 'SPONSORED_BY', 'outgoing');
    const cosponsors = this.traverse(billId, 'CO_SPONSORED_BY', 'outgoing');
    return { primary, cosponsors };
  }

  /**
   * Get all versions of a bill
   */
  getBillVersions(billId) {
    return this.traverse(billId, 'HAS_VERSION', 'outgoing');
  }

  /**
   * Get the current version of a bill
   */
  getCurrentVersion(billId) {
    const edges = this.edges.HAS_VERSION.filter(
      e => e.from === billId && e.properties.isCurrent
    );
    if (edges.length > 0) {
      return this.getNode(edges[0].to);
    }
    return null;
  }

  /**
   * Get all actions for a bill (sorted by sequence)
   */
  getBillActions(billId) {
    const actions = this.traverse(billId, 'HAS_ACTION', 'outgoing');
    return actions.sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Get committee assignment history for a bill
   */
  getBillCommitteeHistory(billId) {
    const edges = this.edges.ASSIGNED_TO.filter(e => e.from === billId);
    return edges.map(edge => ({
      committee: this.getNode(edge.to),
      ...edge.properties
    }));
  }

  /**
   * Get amendments to a bill
   */
  getBillAmendments(billId) {
    const bill = this.nodes.bills[billId];
    if (!bill) return [];

    // Find amendments that target any version of this bill
    const versions = this.getBillVersions(billId);
    const versionIds = versions.map(v => v.id);

    return this.edges.AMENDS
      .filter(e => versionIds.includes(e.to))
      .map(e => this.getNode(e.from))
      .filter(Boolean);
  }

  /**
   * Get full bill graph (all connected nodes)
   */
  getBillGraph(billId) {
    const bill = this.nodes.bills[billId];
    if (!bill) return null;

    return {
      bill,
      sponsor: this.getBillSponsors(billId),
      versions: this.getBillVersions(billId),
      currentVersion: this.getCurrentVersion(billId),
      actions: this.getBillActions(billId),
      committees: this.getBillCommitteeHistory(billId),
      amendments: this.getBillAmendments(billId),
      hearings: this.traverse(billId, 'SCHEDULED_FOR', 'outgoing'),
      votes: this.traverse(billId, 'HAS_VOTE', 'outgoing'),
      session: this.traverse(billId, 'IN_SESSION', 'outgoing')[0]
    };
  }

  // ============================================================
  // MEMBER-SPECIFIC QUERIES
  // ============================================================

  /**
   * Get all bills sponsored by a member
   */
  getMemberSponsoredBills(memberId) {
    return this.traverse(memberId, 'SPONSORED_BY', 'incoming');
  }

  /**
   * Get committees a member serves on
   */
  getMemberCommittees(memberId) {
    const edges = this.edges.MEMBER_OF.filter(e => e.from === memberId);
    return edges.map(edge => ({
      committee: this.getNode(edge.to),
      role: edge.properties.role,
      startDate: edge.properties.startDate
    }));
  }

  /**
   * Get member's voting record
   */
  getMemberVotes(memberId) {
    const edges = this.edges.CAST_VOTE.filter(e => e.from === memberId);
    return edges.map(edge => ({
      vote: this.getNode(edge.to),
      voteValue: edge.properties.voteValue
    }));
  }

  // ============================================================
  // COMMITTEE-SPECIFIC QUERIES
  // ============================================================

  /**
   * Get committee members with roles
   */
  getCommitteeMembers(committeeId) {
    const edges = this.edges.MEMBER_OF.filter(e => e.to === committeeId);
    return edges.map(edge => ({
      member: this.getNode(edge.from),
      role: edge.properties.role
    })).sort((a, b) => {
      // Sort: chair first, then vice_chair, then others
      const roleOrder = { chair: 0, vice_chair: 1, ranking_member: 2, member: 3 };
      return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
    });
  }

  /**
   * Get bills pending in committee
   */
  getCommitteePendingBills(committeeId) {
    const edges = this.edges.ASSIGNED_TO.filter(
      e => e.to === committeeId && e.properties.status === 'pending'
    );
    return edges.map(e => this.nodes.bills[e.from]).filter(Boolean);
  }

  /**
   * Get upcoming hearings for a committee
   */
  getCommitteeHearings(committeeId) {
    return Object.values(this.nodes.hearings)
      .filter(h => h.committeeId === committeeId)
      .sort((a, b) => new Date(a.hearingDate) - new Date(b.hearingDate));
  }

  // ============================================================
  // LIFECYCLE / STATUS QUERIES
  // ============================================================

  /**
   * Get bills at each lifecycle stage
   */
  getBillsByLifecycleStage() {
    const stages = {};
    for (const bill of Object.values(this.nodes.bills)) {
      const status = bill.currentStatus;
      if (!stages[status]) stages[status] = [];
      stages[status].push(bill);
    }
    return stages;
  }

  /**
   * Get bills that need attention (no action in X days)
   */
  getStaleBills(daysThreshold = 14) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    return Object.values(this.nodes.bills).filter(bill => {
      const lastAction = new Date(bill.lastActionDate);
      return lastAction < cutoff && !bill.withdrawn;
    });
  }

  // ============================================================
  // MUTATION OPERATIONS
  // ============================================================

  /**
   * Add a new node
   */
  addNode(nodeType, node) {
    if (!this.nodes[nodeType]) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    this.nodes[nodeType][node.id] = node;
    this._updateTimestamp();
    return node;
  }

  /**
   * Update an existing node
   */
  updateNode(nodeId, updates) {
    const node = this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    const nodeType = node.type;
    delete node.type;
    Object.assign(this.nodes[nodeType][nodeId], updates, {
      updatedAt: new Date().toISOString()
    });
    this._updateTimestamp();
    return this.nodes[nodeType][nodeId];
  }

  /**
   * Add a new edge
   */
  addEdge(edgeType, from, to, properties = {}) {
    if (!this.edges[edgeType]) {
      throw new Error(`Unknown edge type: ${edgeType}`);
    }
    const edge = { from, to, properties };
    this.edges[edgeType].push(edge);
    this._updateTimestamp();
    return edge;
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeType, from, to) {
    if (!this.edges[edgeType]) return false;
    const idx = this.edges[edgeType].findIndex(
      e => e.from === from && e.to === to
    );
    if (idx >= 0) {
      this.edges[edgeType].splice(idx, 1);
      this._updateTimestamp();
      return true;
    }
    return false;
  }

  /**
   * Rebuild indexes
   */
  rebuildIndexes() {
    this.indexes.billsByNumber = {};
    this.indexes.billsByStatus = {};
    this.indexes.billsByCommittee = {};
    this.indexes.membersByDistrict = {};
    this.indexes.actionsByDate = {};
    this.indexes.edgesFrom = {};
    this.indexes.edgesTo = {};

    // Index bills
    for (const [id, bill] of Object.entries(this.nodes.bills)) {
      this.indexes.billsByNumber[bill.billNumber] = id;

      if (!this.indexes.billsByStatus[bill.currentStatus]) {
        this.indexes.billsByStatus[bill.currentStatus] = [];
      }
      this.indexes.billsByStatus[bill.currentStatus].push(id);
    }

    // Index committee assignments
    for (const edge of this.edges.ASSIGNED_TO) {
      if (!this.indexes.billsByCommittee[edge.to]) {
        this.indexes.billsByCommittee[edge.to] = [];
      }
      this.indexes.billsByCommittee[edge.to].push(edge.from);
    }

    // Index members by district
    for (const [id, member] of Object.entries(this.nodes.members)) {
      const key = `${member.chamber}:${member.district}`;
      this.indexes.membersByDistrict[key] = id;
    }

    // Index actions by date
    for (const [id, action] of Object.entries(this.nodes.actions)) {
      if (!this.indexes.actionsByDate[action.actionDate]) {
        this.indexes.actionsByDate[action.actionDate] = [];
      }
      this.indexes.actionsByDate[action.actionDate].push(id);
    }

    // Index edges
    for (const [edgeType, edges] of Object.entries(this.edges)) {
      for (const edge of edges) {
        if (!this.indexes.edgesFrom[edge.from]) {
          this.indexes.edgesFrom[edge.from] = [];
        }
        this.indexes.edgesFrom[edge.from].push({ type: edgeType, to: edge.to });

        if (!this.indexes.edgesTo[edge.to]) {
          this.indexes.edgesTo[edge.to] = [];
        }
        this.indexes.edgesTo[edge.to].push({ type: edgeType, from: edge.from });
      }
    }

    this.data._indexes = this.indexes;
  }

  _updateTimestamp() {
    this.data._meta.updated = new Date().toISOString();
  }

  /**
   * Export the database as JSON
   */
  toJSON() {
    return JSON.stringify(this.data, null, 2);
  }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// Load the database
const fs = require('fs');
const graphData = JSON.parse(fs.readFileSync('./graph.json', 'utf8'));
const graph = new LegislativeGraph(graphData);

// Query examples:

// Get a bill by number
const bill = graph.getBillByNumber('SB 834');
console.log(bill);

// Get full bill graph
const billGraph = graph.getBillGraph('bill:sb834:261');
console.log(billGraph);

// Get bills in committee
const pendingBills = graph.getCommitteePendingBills('committee:senate:insurance_banking');
console.log(pendingBills);

// Get member's sponsored bills
const sponsoredBills = graph.getMemberSponsoredBills('member:senate:28');
console.log(sponsoredBills);

// Get bills at each stage
const byStage = graph.getBillsByLifecycleStage();
console.log(byStage);

// Save changes
fs.writeFileSync('./graph.json', graph.toJSON());
*/

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LegislativeGraph };
}

// Export for ES modules
if (typeof window !== 'undefined') {
  window.LegislativeGraph = LegislativeGraph;
}
