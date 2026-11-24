/**
 * Security Rules Adversarial Payload Specification ("Dirty Dozen")
 * Documents and validates the structural invariants enforced by firestore.rules.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authContext: {
    uid: string | null;
    email: string | null;
    emailVerified: boolean;
  };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_PAYLOADS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on User Profile',
    targetPath: '/users/user_alice',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      uid: 'user_alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      createdAt: 'REQUEST_TIME',
      isAdmin: true,
      upiId: 'alice@okaxis',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUser -> data.keys().hasOnly(["uid", "displayName", "email", "createdAt"])',
  },
  {
    id: 2,
    name: 'User Profile Hijack (Cross-User Read)',
    targetPath: '/users/user_bob',
    operation: 'get',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'users/{userId} allow get: if isOwner(userId)',
  },
  {
    id: 3,
    name: 'User Collection Enumeration',
    targetPath: '/users',
    operation: 'list',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'users/{userId} allow list: if false',
  },
  {
    id: 4,
    name: 'Unverified Email Spoofing on Group Read',
    targetPath: '/groups/goa_trip',
    operation: 'get',
    authContext: { uid: 'attacker_uid', email: 'bob@example.com', emailVerified: false },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isGroupMember requires request.auth.token.email_verified == true for email matching',
  },
  {
    id: 5,
    name: 'Group Creator Spoofing',
    targetPath: '/groups/fake_group',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      id: 'fake_group',
      name: 'Fake Group',
      category: 'Trip',
      inviteCode: 'FAKE01',
      createdBy: 'user_bob',
      memberUids: ['user_alice'],
      memberEmails: ['alice@example.com'],
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'groups allow create enforces incoming().createdBy == request.auth.uid',
  },
  {
    id: 6,
    name: 'ID Poisoning / Invalid Characters',
    targetPath: '/groups/../../bad$id',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: { id: '../../bad$id' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(groupId) regex ^[a-zA-Z0-9_\\-]+$',
  },
  {
    id: 7,
    name: 'Unbounded Array Bomb (> 20 members)',
    targetPath: '/groups/oversized_group',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      id: 'oversized_group',
      name: 'Oversized',
      category: 'General',
      inviteCode: 'OVER21',
      createdBy: 'user_alice',
      memberUids: Array.from({ length: 21 }, (_, i) => `uid_${i}`),
      memberEmails: ['alice@example.com'],
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidGroup enforces memberUids.size() <= 20',
  },
  {
    id: 8,
    name: 'Backdated Timestamp Forgery',
    targetPath: '/groups/goa_trip/expenses/exp_1',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      id: 'exp_1',
      groupId: 'goa_trip',
      createdAt: '1999-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
  {
    id: 9,
    name: 'Immortal Field Mutation on Group',
    targetPath: '/groups/goa_trip',
    operation: 'update',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      createdBy: 'user_bob',
      inviteCode: 'HACKED',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'groups allow update enforces affectedKeys().hasOnly(...) and immutable fields',
  },
  {
    id: 10,
    name: 'Orphaned Expense Creation',
    targetPath: '/groups/nonexistent_group/expenses/exp_orphan',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      id: 'exp_orphan',
      groupId: 'nonexistent_group',
      amount: 100,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate checks parent group existence & membership via get()/exists()',
  },
  {
    id: 11,
    name: 'Negative / Zero Expense Injection',
    targetPath: '/groups/goa_trip/expenses/exp_neg',
    operation: 'create',
    authContext: { uid: 'user_alice', email: 'alice@example.com', emailVerified: true },
    payload: {
      id: 'exp_neg',
      groupId: 'goa_trip',
      type: 'expense',
      title: 'Negative Hack',
      amount: -500,
      paidByMemberId: 'm_alice',
      paidByName: 'Alice',
      splitType: 'equal',
      splits: { m_alice: -500 },
      participantIds: ['m_alice'],
      settledToMemberId: '',
      settledToName: '',
      createdByUid: 'user_alice',
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidExpense enforces data.amount > 0 && data.amount <= 10000000',
  },
  {
    id: 12,
    name: 'Cross-Group Member Privilege Escalation',
    targetPath: '/groups/goa_trip/members/m_attacker',
    operation: 'create',
    authContext: { uid: 'attacker_uid', email: 'attacker@example.com', emailVerified: true },
    payload: {
      id: 'm_attacker',
      groupId: 'goa_trip',
      uid: 'attacker_uid',
      email: 'attacker@example.com',
      displayName: 'Attacker',
      role: 'owner',
      addedByUid: 'attacker_uid',
      joinedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'members allow create requires isParentGroupMember(groupId)',
  },
];
