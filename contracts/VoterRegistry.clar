(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-VOTER-ID u101)
(define-constant ERR-INVALID-ENCRYPTED-DATA u102)
(define-constant ERR-INVALID-PROOF u103)
(define-constant ERR-ALREADY-REGISTERED u104)
(define-constant ERR-VOTER-NOT-FOUND u105)
(define-constant ERR-INVALID-UPDATE u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-AUTHORITY-NOT-SET u108)
(define-constant ERR-INVALID-STATUS u109)
(define-constant ERR-MAX-VOTERS-EXCEEDED u110)
(define-constant ERR-INVALID-LOCATION u111)
(define-constant ERR-INVALID-AGE u112)
(define-constant ERR-INVALID-CITIZENSHIP u113)
(define-constant ERR-INVALID-REGISTRATION-FEE u114)
(define-constant ERR-INVALID-VERIFICATION-THRESHOLD u115)
(define-constant ERR-INVALID-GRACE-PERIOD u116)
(define-constant ERR-INVALID-PENALTY u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-INVALID-ELIGIBILITY u119)
(define-constant ERR-INVALID-AUDIT u120)

(define-data-var next-voter-id uint u0)
(define-data-var max-voters uint u1000000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var verification-threshold uint u50)
(define-data-var grace-period uint u30)

(define-map voters
  uint
  {
    voter-id: (buff 32),
    encrypted-data: (buff 256),
    registered-at: uint,
    status: bool,
    location: (string-utf8 100),
    age: uint,
    citizenship: (string-utf8 50),
    last-update: uint,
    penalty: uint,
    currency: (string-utf8 20)
  }
)

(define-map voters-by-id
  (buff 32)
  uint)

(define-map voter-updates
  uint
  {
    update-encrypted-data: (buff 256),
    update-timestamp: uint,
    updater: principal,
    update-location: (string-utf8 100),
    update-age: uint
  }
)

(define-map voter-audits
  uint
  {
    audit-timestamp: uint,
    auditor: principal,
    audit-status: bool
  }
)

(define-read-only (get-voter (id uint))
  (map-get? voters id)
)

(define-read-only (get-voter-updates (id uint))
  (map-get? voter-updates id)
)

(define-read-only (get-voter-audit (id uint))
  (map-get? voter-audits id)
)

(define-read-only (is-voter-registered (voter-id (buff 32)))
  (is-some (map-get? voters-by-id voter-id))
)

(define-private (validate-voter-id (voter-id (buff 32)))
  (if (and (> (len voter-id) u0) (<= (len voter-id) u32))
      (ok true)
      (err ERR-INVALID-VOTER-ID))
)

(define-private (validate-encrypted-data (data (buff 256)))
  (if (and (> (len data) u0) (<= (len data) u256))
      (ok true)
      (err ERR-INVALID-ENCRYPTED-DATA))
)

(define-private (validate-proof (proof (buff 128)))
  (if (> (len proof) u0)
      (ok true)
      (err ERR-INVALID-PROOF))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-age (age uint))
  (if (>= age u18)
      (ok true)
      (err ERR-INVALID-AGE))
)

(define-private (validate-citizenship (cit (string-utf8 50)))
  (if (and (> (len cit) u0) (<= (len cit) u50))
      (ok true)
      (err ERR-INVALID-CITIZENSHIP))
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (validate-penalty (pen uint))
  (if (<= pen u100)
      (ok true)
      (err ERR-INVALID-PENALTY))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-voters (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-VOTERS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set max-voters new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-REGISTRATION-FEE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (set-verification-threshold (new-threshold uint))
  (begin
    (asserts! (and (> new-threshold u0) (<= new-threshold u100)) (err ERR-INVALID-VERIFICATION-THRESHOLD))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set verification-threshold new-threshold)
    (ok true)
  )
)

(define-public (set-grace-period (new-period uint))
  (begin
    (asserts! (<= new-period u90) (err ERR-INVALID-GRACE-PERIOD))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set grace-period new-period)
    (ok true)
  )
)

(define-public (register-voter
  (voter-id (buff 32))
  (encrypted-data (buff 256))
  (zk-proof (buff 128))
  (location (string-utf8 100))
  (age uint)
  (citizenship (string-utf8 50))
  (penalty uint)
  (currency (string-utf8 20))
)
  (let (
        (next-id (var-get next-voter-id))
        (current-max (var-get max-voters))
        (authority (var-get authority-contract))
        (is-eligible (contract-call? .identity-verifier verify-proof zk-proof))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-VOTERS-EXCEEDED))
    (try! (validate-voter-id voter-id))
    (try! (validate-encrypted-data encrypted-data))
    (try! (validate-proof zk-proof))
    (try! (validate-location location))
    (try! (validate-age age))
    (try! (validate-citizenship citizenship))
    (try! (validate-penalty penalty))
    (try! (validate-currency currency))
    (asserts! is-eligible (err ERR-INVALID_ELIGIBILITY))
    (asserts! (is-none (map-get? voters-by-id voter-id)) (err ERR-ALREADY-REGISTERED))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-SET))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set voters next-id
      {
        voter-id: voter-id,
        encrypted-data: encrypted-data,
        registered-at: block-height,
        status: true,
        location: location,
        age: age,
        citizenship: citizenship,
        last-update: block-height,
        penalty: penalty,
        currency: currency
      }
    )
    (map-set voters-by-id voter-id next-id)
    (var-set next-voter-id (+ next-id u1))
    (print { event: "voter-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-voter
  (voter-uint-id uint)
  (update-encrypted-data (buff 256))
  (update-location (string-utf8 100))
  (update-age uint)
)
  (let ((voter (map-get? voters voter-uint-id)))
    (match voter
      v
        (begin
          (asserts! (is-eq tx-sender tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-encrypted-data update-encrypted-data))
          (try! (validate-location update-location))
          (try! (validate-age update-age))
          (map-set voters voter-uint-id
            {
              voter-id: (get voter-id v),
              encrypted-data: update-encrypted-data,
              registered-at: (get registered-at v),
              status: (get status v),
              location: update-location,
              age: update-age,
              citizenship: (get citizenship v),
              last-update: block-height,
              penalty: (get penalty v),
              currency: (get currency v)
            }
          )
          (map-set voter-updates voter-uint-id
            {
              update-encrypted-data: update-encrypted-data,
              update-timestamp: block-height,
              updater: tx-sender,
              update-location: update-location,
              update-age: update-age
            }
          )
          (print { event: "voter-updated", id: voter-uint-id })
          (ok true)
        )
      (err ERR-VOTER-NOT-FOUND)
    )
  )
)

(define-public (audit-voter (voter-uint-id uint) (audit-status bool))
  (let ((voter (map-get? voters voter-uint-id)))
    (match voter
      v
        (begin
          (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
          (try! (validate-status audit-status))
          (map-set voter-audits voter-uint-id
            {
              audit-timestamp: block-height,
              auditor: tx-sender,
              audit-status: audit-status
            }
          )
          (print { event: "voter-audited", id: voter-uint-id })
          (ok true)
        )
      (err ERR-VOTER-NOT-FOUND)
    )
  )
)

(define-public (get-voter-count)
  (ok (var-get next-voter-id))
)

(define-public (check-voter-existence (voter-id (buff 32)))
  (ok (is-voter-registered voter-id))
)