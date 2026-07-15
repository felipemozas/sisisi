# Security Specification for Zen Infinite Driving High Scores

## 1. Data Invariants
- **Identity Integrity**: A user can only read, create, or update their own score document at `scores/{userId}` where `{userId}` is equal to `request.auth.uid`. No user can access or manipulate other users' scores.
- **Email Validation**: The `email` field must match the verified email of the authenticated user (`request.auth.token.email`).
- **Verified Sign-In**: The user MUST have a verified email address (`request.auth.token.email_verified == true`).
- **Volumetric Boundaries**: The `userId` must be $\le 128$ characters, and the `email` must be $\le 256$ characters.
- **Score Integrity**: The `highScore` value must be a positive number.
- **Temporal Consistency**: The `updatedAt` field must be set using the server-side timestamp (`request.time`).
- **Self-Promotion Safeguards**: A user cannot modify immutable fields such as `userId` or `email` after creation.

---

## 2. The "Dirty Dozen" Payloads (Exploit Vector Scenarios)

These payloads are designed to breach security and must be rejected by the Firestore rules:

1. **Spoofed User ID (Identity Theft)**
   - *Attempt*: Create a record in `scores/victim_uid_123` with `userId` as `victim_uid_123` while authenticated as `attacker_uid_999`.
   - *Target*: Create `scores/victim_uid_123`
   - *Payload*: `{"userId": "victim_uid_123", "email": "victim@example.com", "highScore": 999.9, "updatedAt": request.time}`
   - *Expectation*: `PERMISSION_DENIED`

2. **Unauthenticated Write (Anonymous/Guest Breach)**
   - *Attempt*: Write to `scores/some_uid` without any auth token.
   - *Payload*: `{"userId": "some_uid", "email": "anon@example.com", "highScore": 100.0, "updatedAt": "2026-07-15T00:00:00Z"}`
   - *Expectation*: `PERMISSION_DENIED`

3. **Unverified Email Access (Spoofing)**
   - *Attempt*: Write to `scores/attacker_uid` using a token where `email_verified` is `false`.
   - *Payload*: `{"userId": "attacker_uid", "email": "attacker@example.com", "highScore": 12.0, "updatedAt": request.time}`
   - *Expectation*: `PERMISSION_DENIED`

4. **Massive Character Payload (ID Poisoning/DoS)**
   - *Attempt*: Write with a `userId` or `email` containing a 100KB random string to exhaust Firestore storage/resources.
   - *Payload*: `{"userId": "attacker_uid", "email": "A...[100KB]...@example.com", "highScore": 50.0, "updatedAt": request.time}`
   - *Expectation*: `PERMISSION_DENIED`

5. **Malicious Negative Score (Value Poisoning)**
   - *Attempt*: Update high score to a negative or invalid value.
   - *Payload*: `{"userId": "attacker_uid", "email": "attacker@example.com", "highScore": -500.0, "updatedAt": request.time}`
   - *Expectation*: `PERMISSION_DENIED`

6. **Spoofed Timestamp (Temporal Cheat)**
   - *Attempt*: Set the `updatedAt` field to a future timestamp (e.g. 50 years in the future) or a manual string to bypass server-side tracking.
   - *Payload*: `{"userId": "attacker_uid", "email": "attacker@example.com", "highScore": 75.0, "updatedAt": "2076-07-15T00:00:00Z"}`
   - *Expectation*: `PERMISSION_DENIED`

7. **Immutability Bypass (Modifying Email)**
   - *Attempt*: Change the user's registered email during an update.
   - *Payload*: `{"userId": "attacker_uid", "email": "victim@example.com", "highScore": 85.0, "updatedAt": request.time}`
   - *Expectation*: `PERMISSION_DENIED`

8. **Overwriting Victim ID on Update**
   - *Attempt*: Update `scores/attacker_uid` but set `userId` to `victim_uid_123` to orphan the record.
   - *Payload*: `{"userId": "victim_uid_123", "email": "attacker@example.com", "highScore": 90.0, "updatedAt": request.time}`
   - *Expectation*: `PERMISSION_DENIED`

9. **Ghost Fields Injection (Shadow Update)**
   - *Attempt*: Inject unauthorized properties into the schema (e.g. `"isAdmin": true`, `"hasPremium": true`).
   - *Payload*: `{"userId": "attacker_uid", "email": "attacker@example.com", "highScore": 120.0, "updatedAt": request.time, "isAdmin": true}`
   - *Expectation*: `PERMISSION_DENIED`

10. **Blanket Query List Attack**
    - *Attempt*: Perform a general `list` query across all high scores without filter constraints to scrape users' emails.
    - *Payload*: `getDocs(collection(db, 'scores'))`
    - *Expectation*: `PERMISSION_DENIED`

11. **Inject Non-Numeric Score**
    - *Attempt*: Write high score as a non-numeric string or object (e.g., `"highScore": "Infinity"`).
    - *Payload*: `{"userId": "attacker_uid", "email": "attacker@example.com", "highScore": "Infinity", "updatedAt": request.time}`
    - *Expectation*: `PERMISSION_DENIED`

12. **Foreign Characters/Poisoned Path Variable**
    - *Attempt*: Target write to a path containing toxic characters: `scores/attacker_uid_!!!_$$$` or an excessively long path variable.
    - *Expectation*: `PERMISSION_DENIED`
