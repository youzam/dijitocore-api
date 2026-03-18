📘 INTER-MODULE IMPLEMENTATION PLAYBOOK (FINAL)
🎯 OBJECTIVE

Kuhakikisha:

Admin Blueprint → Code alignment (100%)

Hakuna requirement iliyopungua

Hakuna extra feature zisizo kwenye blueprint (unless harmless API enhancement)

Admin actions zina-reflect kwenye core (tenant side) pale inapohitajika

🧩 PHASE 1: MODULE ALIGNMENT (MANDATORY FIRST STEP)

👉 Hii ndiyo hatua ya kwanza kila module

🔍 Step 1: Scan Inputs

Admin Blueprint (module husika)

API ZIP (code halisi)

🔍 Step 2: Extract Blueprint Requirements

👉 Blueprint haina functions — hivyo:

Soma blueprint kuelewa:

capabilities zinazotakiwa

actions zinazotarajiwa (CRUD + special behaviors)

constraints (permissions, rules, flows)

🔍 Step 3: Compare With Code (STRICT)
A. Service Layer

je kuna functions zinazotekeleza requirements za blueprint?

je logic ina-match blueprint (sio jina tu)?

B. Controller Layer

je service functions zinaitwa?

je parameters ziko sahihi? (actor, roleId, etc)

C. Routes Layer

je endpoints zipo?

je zinalindwa correctly? (auth + permission)

📊 Output ya Phase 1
✔️ Implemented (aligned with blueprint)
❌ Requirement missing in service
❌ Not exposed in controller
❌ Not exposed in routes
⚠️ Mismatch (logic / arguments / flow)
🚫 RULES

❌ No assumptions

❌ No rewriting full files

✅ Only patch gaps

✅ Use python scan where needed

🔗 PHASE 2: INTER-MODULE INTEGRATION

👉 Hii inakuja BAADA ya Phase 1 kukamilika

🔍 Step 1: Identify Admin Writes

👉 Identify service functions zinazobadilisha state:

- Create / Update / Delete

🔍 Step 2: Ask This Question (STRICT)

👉 “Je hii action inapaswa ku-affect core modules (tenant side)?”

- Tenant side modules are (Auth, business, contract, customer, dashboard, device, notification, payment, subscription and webhooks)

🔍 Step 3: Check Blueprint (Inter-module)

Je gap imeelezwa?

✔️ ndiyo → verify implementation

❌ hapana → evaluate logically (no guessing, reasoned only)

- identify expected tenant requirements

🔍 Step 4: Check Code

je integration ipo?

je effect inaonekana upande wa core?

📊 Output ya Phase 2
✔️ No integration needed
✔️ Already implemented
❌ Missing integration (critical)
⚠️ Optional improvement
🧠 DECISION RULE
Condition Action
No gaps 👉 move to next module
Gaps exist 👉 fix ONLY those gaps
Not in blueprint but critical 👉 flag before fixing
⚙️ PHASE 3: FIXING (CONTROLLED)

👉 Only after analysis

Fix types:

1. Alignment fixes

missing logic for requirement

wrong arguments

missing controller exposure

missing route

2. Integration fixes

token invalidation

cross-module effect

status propagation

🚫 RULES

❌ No over-engineering

❌ No adding new architecture

✅ Minimal patch

✅ Stay consistent with existing code

🔄 WORKFLOW PER MODULE

1. Scan blueprint
2. Scan code (ZIP)
3. Phase 1 → Alignment
4. Fix alignment
5. Phase 2 → Integration
6. Fix integration (if any)
7. Mark module COMPLETE
8. Move to next module
