# SettleUp Security Specification

## 1. Data Invariants

1. **User PII Isolation (`users/{userId}`)**:
   - Only `uid`, `displayName`, `email`, and `createdAt` may be stored. No phone numbers, UPI IDs, or banking fields are permitted.
   - A user document is readable and writable strictly by `request.auth.uid == userId`. No global listing (`allow list`) is permitted.
   - `uid` and `createdAt` are immutable after creation; `createdAt` must equal `request.time` on creation.

2. **Group Ownership & Bounded Membership (`groups/{groupId}`)**:
   - Only users whose `request.auth.uid` is in `memberUids` OR whose verified `request.auth.token.email` (lowercased) is in `memberEmails` may read or list a group.
   - `memberUids` and `memberEmails` are strictly bounded to `<= 20` entries.
   - `createdBy`, `id`, `inviteCode`, and `createdAt` are immutable after creation.
   - Invited users joining via verified email may only append their own `request.auth.uid` to `memberUids`.

3. **Master Gate on Subcollections (`groups/{groupId}/members/{memberId}` & `groups/{groupId}/expenses/{expenseId}`)**:
   - Every subcollection document requires the parent `/groups/{groupId}` document to exist and the requesting user to be an active or verified-invited member of that parent group.
   - Expense amounts must be strictly positive numbers (`> 0` and `<= 10000000`), and `createdByUid` must match `request.auth.uid` on creation.
   - Expense entries are append-only audit records (deletable only by the creator or group owner, and immutable `groupId`/`createdByUid`/`createdAt`).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on User Profile**: Creating `users/{uid}` with extra field `isAdmin: true` or `upiId: "test@upi"`. Expected: `PERMISSION_DENIED`.
2. **User Profile Hijack**: Authenticated user A reading or overwriting `users/{userB}`. Expected: `PERMISSION_DENIED`.
3. **User Collection Enumeration**: Running a `list` query on `/users` to scrape all registered emails. Expected: `PERMISSION_DENIED`.
4. **Unverified Email Spoofing on Group Read**: User with `email_verified: false` claiming an email listed in `memberEmails` trying to read or list the group. Expected: `PERMISSION_DENIED`.
5. **Group Creator Spoofing**: Creating `/groups/{groupId}` with `createdBy` set to another user's UID. Expected: `PERMISSION_DENIED`.
6. **ID Poisoning / Resource Exhaustion**: Writing a group or expense with an invalid 1KB document ID containing special characters. Expected: `PERMISSION_DENIED`.
7. **Unbounded Array Bomb**: Creating a group with `memberUids` or `memberEmails` containing > 20 entries. Expected: `PERMISSION_DENIED`.
8. **Backdated Timestamp Forgery**: Creating a user, group, or expense with a forged client `createdAt` timestamp instead of `request.time`. Expected: `PERMISSION_DENIED`.
9. **Immortal Field Mutation**: Updating a group to change `createdBy`, `inviteCode`, or `createdAt`. Expected: `PERMISSION_DENIED`.
10. **Orphaned Expense Creation**: Creating `/groups/nonexistent_group/expenses/{expenseId}` without a valid parent group. Expected: `PERMISSION_DENIED`.
11. **Negative / Zero Expense Injection**: Creating an expense with `amount: -500` or `amount: 0` to corrupt group balances. Expected: `PERMISSION_DENIED`.
12. **Cross-Group Member Privilege Escalation**: Non-member attempting to add themselves to `groups/{groupId}/members` or mutate expenses. Expected: `PERMISSION_DENIED`.
