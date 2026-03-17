🧠 SYSTEM INTER-MODULE BLUEPRINT (FINAL)
GOAL:
Kila admin action lazima ibadilishe behavior ya system (core modules)
📦 1. COMMERCE MODULE
🧾 ADMIN ACTIONS

- Create / update coupon
- Create adjustment
- Define package (features, limits)
- Refund subscriptionPayment
- Control subscription (upgrade/cancel/extend)
  🔗 DB WRITES
  coupon
  adjustment
  package (features, limits)
  subscriptionPayment.status
  🚨 CORE GAP
  coupon → not used in subscription payment flow
  adjustment → not applied in billing
  package.limits → not enforced in any module
  package.features → not enforced
  refund → subscription not updated
  ✅ REQUIRED FIX
  subscription.payment.service:
  - apply coupon
  - apply adjustment
  - handle refund

subscription.authority:

- enforce limits + features across:
  customer / contract / device
  📦 2. COMMUNICATION MODULE
  🧾 ADMIN ACTIONS
- Send messages
- Create announcements
- Create templates
  🔗 DB WRITES
  announcement
  message
  messageRecipient
  messageTemplate
  🚨 CORE GAP
  announcement → not visible anywhere
  message → not used by notification system
  messageRecipient → unused
  messageTemplate → unused
  ✅ REQUIRED FIX
  notification module:
  - consume message + messageRecipient
  - apply messageTemplate

dashboard:

- expose announcements

core modules:

- trigger communication events (reverse flow)
  📦 3. COMPLIANCE MODULE
  🧾 ADMIN ACTIONS
- Create retention policy
- Approve data requests
- Queue purge
  🔗 DB WRITES
  dataRetentionPolicy
  dataRequest
  purgeQueue
  auditLog
  🚨 CORE GAP
  retentionPolicy → not enforced
  dataRequest → not executed
  purgeQueue → deletes data silently
  auditLog → not used
  ✅ REQUIRED FIX
  jobs:
  - enforce retention
  - process dataRequest

core modules:

- validate entity existence (purge-safe)

reporting:

- consume auditLog
  📦 4. GOVERNANCE MODULE
  🧾 ADMIN ACTIONS
- Suspend business
- Change user.status (ACTIVE / INACTIVE / SUSPENDED)
- lock user and unlock
- lockUntil
- Change subscription
- Extend grace period
- Force logout
- Reset password
- Impersonate user
  🔗 DB WRITES
  business.status
  user.status
  subscription override
  gracePeriod
  sessions
  password
  🚨 CORE GAP
  business.status → not checked anywhere
  user.status → not enforced in auth
  gracePeriod → ignored
  forceLogout → tokens still valid
  resetPassword → sessions still active
  impersonation → no audit / restriction
  ✅ REQUIRED FIX
  auth:
  - block user.status !== ACTIVE
  - validate session on every request

all modules:

- assert business.status === ACTIVE

subscription:

- respect gracePeriod

security:

- log + restrict impersonation
  📦 5. OPERATION MODULE
  🧾 ADMIN ACTIONS
- Toggle feature flags
- Enable maintenance mode
- Control job processing
  🔗 DB WRITES
  systemSetting.featureFlags
  🚨 CORE GAP
  MAINTENANCE_MODE → not enforced
  API_WRITE_ENABLED → ignored
  PAYMENTS_ENABLED → ignored (subscription)
  JOB_PROCESSING_ENABLED→ ignored
  ✅ REQUIRED FIX
  auth:
  - block all requests if maintenance

subscription:

- respect PAYMENTS_ENABLED

core modules:

- block writes if API_WRITE_ENABLED = false

jobs:

- stop if JOB_PROCESSING_ENABLED = false
  📦 6. REPORTING MODULE
  🧾 ADMIN ACTIONS
- Generate reports
- Export data
  🔗 DB WRITES
  reportExport
  🚨 CORE GAP
  NONE
  ✅ STATUS
  Fully isolated (no integration needed)
  📦 7. SECURITY MODULE
  🧾 ADMIN ACTIONS
- Revoke sessions
- Flag fraud
- Mark transactions flagged
- Create incidents
  🔗 DB WRITES
  refreshToken.revokedAt
  fraudFlag
  transaction.flagged
  securityIncident
  🚨 CORE GAP
  revoked tokens → not enforced
  fraudFlag → not enforced
  transaction.flagged→ ignored
  securityIncident → not used
  ✅ REQUIRED FIX
  auth:
  - reject revoked tokens

subscription:

- block flagged transactions

system:

- react to fraudFlag / incidents
  📦 8. SETTING MODULE
  🧾 ADMIN ACTIONS
- Update system config
  🔗 DB WRITES
  systemSetting

Fields:

currency
activePaymentGateway
maxLoginAttempts
lockTimeMinutes
notificationConfig
maintenanceConfig
🚨 CORE GAP
currency → not used
activePaymentGateway → not used
maxLoginAttempts → not enforced
lockTimeMinutes → not enforced
notificationConfig → not used
maintenanceConfig → not enforced
✅ REQUIRED FIX
auth:

- enforce login limits

subscription:

- use activePaymentGateway

notification:

- respect notificationConfig

auth/global:

- enforce maintenanceConfig
  📦 9. SUPPORT MODULE
  🧾 ADMIN ACTIONS
- Manage tickets
- Assign tickets
- Send messages
- Escalate tickets
  🔗 DB WRITES
  ticket
  ticketMessage
  ticketNote
  ticketAttachment
  🚨 CORE GAP
  ticket.businessId → business status not checked
  events → not guaranteed consumed
  ✅ REQUIRED FIX
  before ticket actions:
  - assert business.status === ACTIVE

communication module:

- handle:
  TICKET_MESSAGE
  TICKET_ASSIGNED
  TICKET_ESCALATED
