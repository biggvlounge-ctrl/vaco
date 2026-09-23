# VASH TAP — MASTER BUILD COMMAND

STATUS: MASTER FREEZE / BUILD COMMAND — **filed 23 Sep 2026, on deck.**
Owner's instruction: file it now, finish the VACON-C game work first.

Verbatim as frozen by the owner. Do not edit the text below; it is the
specification, and an edited copy is a different specification.

**Nothing here is built, and that is a deliberate deferral rather than a
refusal.** This document is written as a build command ("THIS IS A BUILD
COMMAND, NOT A CONCEPT DOCUMENT") and its §1 and §55 both require an
audit of the existing VACO codebase before any code is written. The
owner filed it and directed VACON-C first, so the audit has not started.

**Two compliance gates from this folder's README bear on it directly**
and are not overridden by anything in the text below:

- There is no standalone `/api/banking/*`; banking routes through VASH.
- V3 is the canonical VCoin/VASH ledger with idempotent settlement
  (`settleOnce.js`), which is precisely what §1 and §7 mean by "do not
  create a separate wallet, ledger, payment system or financial
  account".

---

## VACO / VASH MASTER FREEZE

BACKEND + FRONTEND + DATABASE + ANALYTICS + SECURITY + RUNNABLE

CLAUDE CODE: THIS IS A BUILD COMMAND, NOT A CONCEPT DOCUMENT.

BUILD VASH TAP AS A REAL, RUNNABLE, PRODUCTION-READY SYSTEM INSIDE THE EXISTING VACO CODEBASE.

DO NOT STOP AT DOCUMENTATION.
DO NOT BUILD A MOCKUP ONLY.
DO NOT CREATE FAKE PAYMENT FLOWS.
DO NOT CREATE DUPLICATE VACO INFRASTRUCTURE.

FIRST INSPECT THE EXISTING VACO CODEBASE, THEN REUSE AND EXTEND WHAT ALREADY EXISTS.

---

## 1. NON-DUPLICATION MASTER RULE

VASH TAP MUST BE BUILT ON TOP OF THE EXISTING VACO PLATFORM.

Before creating anything, inspect and reuse existing implementations for:

* Authentication
* User accounts
* VACA identity/verification
* Profiles
* Avatars
* VASH
* Wallets
* VCoin
* Payment/transaction infrastructure
* Ledger
* Notifications
* Push notifications
* Messaging/DMs
* Business accounts
* Employee accounts
* Locations
* Scheduling
* Search
* Analytics
* Audit logs
* QVAN/security
* Fraud controls
* AI
* V4
* ARIES
* MIA/VACON
* Design system
* API conventions
* Database conventions
* Testing
* Maps/location infrastructure
* Existing social/profile infrastructure

DO NOT BUILD SECOND VERSIONS OF THESE SYSTEMS.

VASH TAP is an additional physical-to-digital layer that connects compatible NFC endpoints to existing VACO infrastructure.

---

## 2. WHAT VASH TAP IS

VASH TAP is VASH's physical-to-digital interaction network.

A physical VASH TAP can be:

* Wristband
* Bracelet
* Silicone band
* Cloth/elastic band
* Premium metal band
* Personal NFC card
* Bag
* Purse
* Money bag
* Wallet
* Jacket
* Shirt
* Dress
* Bra/bralette
* Performance outfit
* Costume
* Shoe
* Hat
* Jewelry/accessory
* Equipment
* Merchandise
* Product
* Table
* Barber chair
* Bartender station
* Server station
* Stage
* Room
* Venue point
* Business station
* Event station
* Any compatible physical object

The Tap becomes the digital doorway into:

* Payment
* Tip
* Identity
* Profile
* Messaging
* Social media
* Following
* Booking
* Access
* Product discovery
* Product ordering
* Analytics
* Business activity
* Event interaction
* Other authorized VACO functions

---

## 3. PRODUCT FAMILY

BUILD THESE PRODUCT TYPES:

A. VASH TAP PERSONAL

For individuals.

Examples:

* Wristbands
* Bracelets
* Cards
* Personal wearable devices

Functions:

* Pay
* Receive
* Tip
* Identity
* Profile
* Message
* Follow
* Connect
* Access where supported

B. VASH BUSINESS TAP

For businesses.

Examples:

* Tables
* Barber chairs
* Bartender stations
* Server stations
* Checkout stations
* Stages
* Rooms
* Employee stations
* Service stations
* Event stations

C. VASH TAP WEAR

NFC incorporated directly into:

* Clothing
* Jackets
* Dresses
* Shirts
* Uniforms
* Performance costumes
* Bras/bralettes
* Shoes
* Hats
* Accessories

D. VASH TAP EMBED

Small standalone NFC inlay/module.

Designed to be incorporated into:

* Bags
* Purses
* Money bags
* Wallets
* Clothing
* Merchandise
* Equipment
* Products
* Luxury goods

It should be possible to sell VASH TAP EMBED individually or in packs.

Support product quantities such as:

* 1
* 5
* 10
* 25
* 100
* 500
* 1,000+

E. VASH TAP POINT

A physical business/location endpoint.

Examples:

* Chair 7
* Table 18
* Stage A
* Bar Station 3
* Room 402
* Employee Station
* VIP Entrance
* Event Booth

---

## 4. PERMANENT TAP ID

Every physical Tap receives a unique permanent Tap ID.

Example:

VT-000001
VT-000002
VT-000003

The Tap ID identifies the physical endpoint.

The physical Tap must NOT permanently encode a person's identity or financial information.

Separate:

TAP ID
PHYSICAL OBJECT
CURRENT ASSIGNMENT
OWNER
BUSINESS
LOCATION
EMPLOYEE
PERFORMER
PRODUCT
SERVICE
EVENT
SCHEDULE
HISTORY

The software determines the current context.

---

## 5. DYNAMIC TAP ASSIGNMENT

A Tap can dynamically change who or what it represents.

Example:

BARBER CHAIR 7

9:00 AM–2:00 PM
→ Barber A

2:00 PM–8:00 PM
→ Barber B

8:00 PM–10:00 PM
→ Barber C

The physical Tap remains the same.

The software changes the active assignment.

Support:

* Date-specific assignments
* Time-specific assignments
* Recurring schedules
* Day-of-week schedules
* Employee schedules
* Performer schedules
* Event schedules
* Location schedules
* Temporary assignments
* Manual overrides
* Emergency overrides
* Future assignments
* Assignment expiration
* Conflict detection
* Assignment history

Every assignment change must be auditable.

---

## 6. TAP RESOLUTION

When someone taps a VASH TAP:

1. Identify Tap ID.
2. Verify Tap status.
3. Determine current date/time.
4. Resolve current assignment.
5. Resolve VACA identity.
6. Resolve business.
7. Resolve location.
8. Resolve product/object/service/event.
9. Resolve permissions.
10. Resolve available actions.
11. Open appropriate profile/context.
12. Allow authorized payment or interaction.
13. Trigger appropriate notification.
14. Record the event.
15. Attribute the event to the Tap.
16. Update analytics.

---

## 7. VASH TAP PAYMENT

VASH TAP must use the EXISTING VASH financial infrastructure.

DO NOT create:

* Separate wallet
* Separate ledger
* Separate payment system
* Separate financial account

Flow:

VASH TAP
→ VACA identity/authorization
→ VASH authorization
→ EXISTING VASH TRANSACTION SYSTEM
→ Existing ledger
→ Recipient/business
→ Notification
→ Analytics attribution

Every transaction should retain the appropriate:

* Tap ID
* Transaction ID
* Date/time
* Business
* Location
* Tap type
* Object/product/service
* Employee/performer where appropriate
* Event where appropriate
* Amount
* Tip
* Status
* Authorized context

Transaction states must support existing VASH capabilities such as:

* Pending
* Completed
* Failed
* Declined
* Reversed
* Refunded
* Disputed

Never show a payment as successful before the existing VASH transaction system confirms it.

---

## 8. IMMEDIATE PHONE ALERTS

When a VASH TAP payment is successfully completed, the recipient should receive an immediate phone notification similar in experience to a Cash App payment alert.

The alert should be capable of:

* Sound
* Vibration/haptic
* Push notification
* Lock-screen notification
* In-app notification

Example:

VASH TAP
PAYMENT RECEIVED
$25.00
Performance Tip

The alert system MUST reuse existing VACO notification infrastructure.

Support user-configurable notification settings.

---

## 9. VASH TAP MESSAGING

Allow a sender to attach a message to a transaction.

Example:

$25.00 sent
"Great performance tonight!"

Recipient receives:

* Transaction alert
* Message
* Transaction record
* Reply option if permitted

Also support messaging without a payment when the recipient permits it.

Possible modes:

* Payment only
* Payment + message
* Message without payment
* One-way messages
* Two-way messages
* Business messages
* Performer messages
* Booking inquiries
* Service inquiries

Controls:

* Allow replies
* Disable replies
* Business-hours only
* Followers only
* Approved users
* Block
* Report
* Restrict

Reuse existing VACO messaging/DM infrastructure.

---

## 10. VASH TAP PROFILE

Every Tap may resolve to a VASH TAP Profile.

Profile can show:

* Name
* Display name
* Avatar/photo
* VACA identity
* Business
* Role
* Current context
* Services
* Payment/tipping
* Messaging
* Follow
* Booking
* Social links
* Vulture profile
* Vault Studios profile
* HUNT profile
* VENVS profile
* Events
* Portfolio
* Content
* Authorized external links

The same person does NOT need separate identities for every Tap.

VACA remains the underlying identity.

---

## 11. SOCIAL MEDIA + VACO LINKS

Allow users and businesses to connect authorized profiles and social accounts.

Support:

* Instagram
* TikTok
* YouTube
* Other supported social platforms
* Booking pages
* Websites
* HUNT
* Vault Studios
* Vulture
* VENVS
* Other VACO businesses

The user/business controls which links appear on each Tap.

Example:

PERSONAL TAP
→ personal social links

HUNT PERFORMER TAP
→ HUNT + performer social links

VAULT STUDIOS COSTUME
→ Vault Studios + creator links

VENVS EVENT TAP
→ VENVS + event links

---

## 12. FOLLOW / CONNECT

After tapping, users may be able to:

* Follow
* Save
* Connect
* Subscribe where existing VACO systems support it
* Save a business
* Save a performer
* Save a product

Do not expose private phone numbers or personal contact information automatically.

---

## 13. TAP-TO-SHOP / OBJECT COMMERCE

THIS IS A CORE VASH TAP FEATURE.

A business can put a VASH TAP EMBED inside or on a physical product.

Example:

A person is wearing a jacket.

Someone likes the jacket.

They tap the jacket.

VASH opens the product profile.

The customer can:

* View product
* View price
* View sizes
* View colors
* View stock
* View materials
* View product information
* View images
* Customize
* Add to cart
* Buy now
* Order another size
* Order another color
* Save
* Share

Support:

TAP-TO-DISCOVER
TAP-TO-SHOP
TAP-TO-ORDER
TAP-TO-CUSTOMIZE
TAP-TO-SAVE
TAP-TO-SHARE
TAP-TO-PAY

Products can include:

* Jackets
* Dresses
* Shoes
* Handbags
* Jewelry
* Hats
* Furniture
* Artwork
* Equipment
* Merchandise
* Luxury products
* Performance costumes
* Collectibles
* Other compatible products

The Tap should be able to represent the product without permanently belonging to the person displaying it.

---

## 14. PRODUCT ATTRIBUTION

A Tap can represent a product.

Example:

Tap ID:
VT-88421

Product:
DEGVCHI Jacket DG-204

SKU:
DG-204-BLK

Current display context:
Employee 17

Inventory:
38

Price:
$450

The Tap can track:

* Product views
* Taps
* Saves
* Shares
* Add-to-cart
* Purchases
* Conversion
* Revenue
* Locations
* Events
* Display contexts

---

## 15. VASH TAP ANALYTICS

THIS IS A CORE REQUIREMENT.

Every Tap interaction must be attributable to its specific Tap ID whenever appropriate.

Track:

* Total revenue
* Transaction count
* Average transaction
* Tips
* Purchases
* Unique tappers
* Messages
* Follows
* Product views
* Product orders
* Active hours
* Tap utilization
* Business
* Location
* Employee
* Performer
* Outfit
* Product
* Service
* Event
* Date
* Time

---

## 16. REVENUE ATTRIBUTION

A transaction must be attributable to:

TAP
→ TRANSACTION
→ REVENUE
→ BUSINESS
→ LOCATION
→ PERSON/OBJECT
→ EVENT
→ PRODUCT/SERVICE

Example:

HUNT Barber Shop

Chair 1 → $4,820
Chair 2 → $6,140
Chair 3 → $3,970
Chair 4 → $7,210
Chair 5 → $5,430

Managers can drill into each Tap.

---

## 17. ENTERTAINER OUTFIT ANALYTICS

A performer can have VASH TAP EMBED inside different outfits.

Example:

Maya

Outfit 001
Black Performance Outfit

Outfit 002
Red Performance Outfit

Outfit 003
Gold Performance Outfit

Outfit 004
Vault Studios Costume

Outfit 005
VIP Event Outfit

Each can have its own Tap ID.

Analytics show:

* Revenue
* Tips
* Transactions
* Average transaction
* Unique tappers
* Messages
* Follows
* Events
* Venues
* Active hours
* Revenue by date
* Revenue by location

This allows the performer to understand which physical Tap-enabled objects generate activity.

---

## 18. SPENDER-SIDE COMPLETE TRACKING

THIS IS REQUIRED.

The spender/customer must have their own VASH TAP activity center.

They can see:

* Every VASH TAP payment
* Date
* Exact transaction time
* Amount
* Tip
* Recipient
* Business
* Tap context
* Location/business context
* Product/service/event
* Payment status
* Receipt
* Message
* Transaction/reference ID
* Refunds
* Reversals
* Disputes
* Relevant VCoin/VASH information

The spender should have complete visibility into THEIR OWN financial activity.

The business should not automatically receive unnecessary private customer information.

---

## 19. SPENDER SECURITY CENTER

Spenders can view:

* Recent Tap activity
* Recent payments
* Failed payments
* New device activity
* Connected Taps
* Connected wearables
* Security events
* Suspicious activity
* Active sessions
* Authorized devices
* Notification history
* Lost/stolen Tap status

Spender controls:

* Freeze Tap
* Unfreeze Tap
* Maximum payment amount
* Maximum daily Tap spending
* Confirmation above certain amount
* Device authentication
* Biometric/device authentication where supported
* Block unfamiliar Tap types
* Report transaction
* Dispute transaction

---

## 20. VASH TAP SMART CONTROLS

Every Tap should support digital controls.

Controls include:

* ON
* OFF
* LOCK
* UNLOCK
* SCHEDULED
* LIMITED
* FROZEN

Configure:

* Start time
* End time
* Date
* Days of week
* Start/end date
* Maximum number of taps
* Maximum successful transactions
* Maximum transaction amount
* Maximum daily amount
* Maximum event amount
* Maximum period amount
* Single-use Tap
* Limited-use Tap
* Confirmation threshold
* Authentication requirement
* Automatic lock
* Automatic expiration
* Suspicious activity lock
* Emergency freeze
* Remote disable

Example:

Jacket Tap:

Active:
6 PM–11 PM

Maximum transactions:
20

Maximum transaction:
$500

Maximum daily volume:
$2,000

After 20 successful transactions:
LOCK

Outside operating hours:
OFF

---

## 21. SECURITY CONTROLS

Use existing VACO/QVAN security infrastructure.

Support:

* Ownership verification
* Business authorization
* Employee permissions
* Manager permissions
* Owner permissions
* Admin permissions
* Payment authorization
* Messaging authorization
* Profile permissions
* Social permissions
* Anti-tampering
* Rate limiting
* Suspicious activity detection
* Audit logs
* Lost/stolen Tap controls
* Emergency freeze
* Remote disable

Track unsuccessful Tap attempts as well as successful transactions.

Example:

7 attempts in 60 seconds
→ security threshold reached
→ temporary Tap lock
→ owner notified

Do not create a second security platform.

---

## 22. TWO-SIDED TRANSACTION RECORD

The same underlying VASH transaction must provide two appropriate views.

SPENDER:

"I spent $40 at HUNT Barber Shop, Chair 7, 3:42 PM."

RECIPIENT:

"VASH TAP transaction received: $40, Chair 7, 3:42 PM."

Both reference the same underlying transaction ID.

---

## 23. GEOGRAPHIC / TARGET-AREA ANALYTICS

VASH TAP must support authorized geographic analytics.

Businesses can analyze:

* City
* Market
* Business location
* Venue
* Event
* Tap Point
* Geographic area
* Time period

Example:

NORTH COUNTY MARKET
→ 1,842 VASH TAP transactions
→ $48,320 volume
→ 736 unique customers

Then drill down:

LOCATION B
→ Performer
→ Outfit
→ Stage
→ Event
→ Time
→ Revenue

Analytics chain:

AREA
→ LOCATION
→ BUSINESS
→ TAP
→ PERSON/OBJECT
→ TRANSACTION

Use existing VACO maps/location systems where available.

Customer privacy must be respected.

Use aggregated/anonymized information when appropriate.

Do not expose individual customer information unless authorized and permitted.

---

## 24. VASH TAP CONTROL CENTER

Build an interactive Control Center.

Sections:

1. Overview
2. My Taps
3. Business Taps
4. Personal Taps
5. Wearables
6. Embedded Taps
7. Tap Points
8. Assignments
9. Schedule
10. Transactions
11. Messages
12. Notifications
13. Analytics
14. Geographic Analytics
15. Products
16. Profiles
17. Social Links
18. Employees
19. Locations
20. Events
21. Security
22. Audit Logs
23. Settings

---

## 25. BUSINESS TAP MANAGEMENT

Businesses can:

* Create Tap Points
* Register NFC devices
* Name Tap Points
* Assign employees
* Assign performers
* Assign services
* Assign products
* Assign locations
* Schedule assignments
* Configure payment
* Configure messaging
* Configure social links
* Configure notifications
* View revenue
* View analytics
* Compare Taps
* Freeze/unfreeze Taps
* Activate/deactivate Taps
* View audit history

---

## 26. BUSINESS EXAMPLES

BARBER:

Chair 7 Tap
→ Current barber
→ Service
→ Payment
→ Tip
→ Message
→ Schedule
→ Analytics

BARTENDER:

Bar Station Tap
→ Current bartender
→ Tip/payment
→ Social/profile
→ Messages
→ Shift assignment
→ Analytics

ENTERTAINER:

Stage Tap
→ Performer
→ Payment/tip
→ Social
→ Message
→ Event
→ Analytics

PERFORMER OUTFIT:

Costume Tap
→ Performer
→ Tip/payment
→ Social
→ Message
→ Outfit analytics

RESTAURANT:

Table Tap
→ Table
→ Current server
→ Menu/order/payment
→ Tip
→ Message
→ Server analytics

BUSINESS PRODUCT:

Jacket Tap
→ Product
→ Product page
→ Size/color
→ Purchase
→ Product analytics

---

## 27. CUSTOM VASH TAP PLAQUES

Create a VASH TAP physical plaque customization system.

Available for:

* Personal users
* Businesses
* Employees
* Performers
* Venues
* Tap Points

Customization options:

* Gold
* Silver
* Brushed metal
* Polished metal
* Black metal
* Stainless steel
* Brass
* Aluminum
* Acrylic
* Wood
* Leather
* Premium finishes
* Engraving
* Laser engraving
* Raised lettering
* Printed graphics
* Name
* Company name
* Logo
* Initials
* Monogram
* Employee name
* Performer name
* Department
* Room number
* Chair number
* Station number
* Custom wording
* Optional QR code
* Custom shape
* Custom size

Examples:

WILLIAM LESLIE
VASH TAP

HUNT BARBER SHOP
CHAIR 07

VAULT STUDIOS
STUDIO 03

---

## 28. PLAQUE ORDERING SYSTEM

Allow:

Choose Tap Point
→ Choose material
→ Choose finish
→ Choose size
→ Add name/company
→ Add logo
→ Choose engraving
→ Preview
→ Order
→ Activate Tap

Support bulk business orders.

Example:

25 Tap Points

10 Gold
10 Silver
5 Black

Custom logo
Numbered 01–25

Every physical unit receives its own permanent Tap ID.

---

## 29. PHYSICAL / DIGITAL SEPARATION

A plaque may permanently say:

CHAIR 07

while the backend dynamically determines:

Tap ID
→ HUNT Barber Shop
→ Location
→ Chair 07
→ Current Barber
→ Payment Rules
→ Messaging Rules
→ Analytics

The physical hardware can remain unchanged while the software changes.

---

## 30. VASH TAP EMBED ACTIVATION

Standalone Embed workflow:

1. User purchases VASH TAP EMBED.
2. Open VASH.
3. Select Add VASH TAP.
4. Tap physical NFC.
5. Identify Tap ID.
6. Verify ownership.
7. Choose object type.
8. Assign profile/business/product.
9. Configure permissions.
10. Configure security.
11. Activate.

Object types:

* Personal
* Clothing
* Outfit
* Bag
* Purse
* Wallet
* Equipment
* Product
* Business station
* Table
* Chair
* Stage
* Event
* Other

---

## 31. PERSONAL TAP ONBOARDING

1. User receives VASH TAP.
2. Open VASH.
3. Add Tap.
4. Tap physical device.
5. Verify.
6. Assign Personal Tap.
7. Configure payment.
8. Configure profile.
9. Configure social links.
10. Configure messaging.
11. Configure security.
12. Activate.
13. Test.

---

## 32. BUSINESS TAP ONBOARDING

1. Business opens VASH Business.
2. Select VASH Business Tap.
3. Select/create location.
4. Add Tap Point.
5. Register NFC.
6. Name Tap.
7. Select Tap type.
8. Assign employee/service/product.
9. Schedule assignment.
10. Configure payment.
11. Configure messaging.
12. Configure social links.
13. Configure notifications.
14. Activate.
15. Monitor.

---

## 33. ANALYTICS DASHBOARD

Display:

* Revenue
* Transactions
* Tips
* Average transaction
* Unique tappers
* Messages
* Follows
* Product interactions
* Purchases
* Tap utilization
* Active hours
* Business
* Location
* Employee
* Performer
* Product
* Outfit
* Service
* Event

Date filters:

* Today
* Yesterday
* This week
* Last week
* This month
* Last month
* This year
* Custom

---

## 34. TAP COMPARISON

Authorized users can compare their own Tap endpoints.

Examples:

Chair 1 vs Chair 2 vs Chair 3

Outfit 1 vs Outfit 2 vs Outfit 3

Table 1 vs Table 2

Stage A vs Stage B

Product A vs Product B

Compare:

* Revenue
* Transactions
* Average transaction
* Tips
* Unique tappers
* Messages
* Follows
* Utilization

Do not expose private analytics to unauthorized users.

---

## 35. TAP HISTORY

Every Tap must retain historical assignment/activity records.

Example:

Tap:
VT-000184

Current:
Gold Performance Outfit
→ Maya
→ HUNT Entertainment
→ Event XYZ

Previous:
Gold Performance Outfit
→ Maya
→ Vault Studios
→ Previous event

Historical records must remain auditable.

---

## 36. FRONTEND REQUIREMENTS

Use the existing VACO design system.

Do not create a disconnected application.

Build mobile-first experiences for:

* Tap scanning
* Profile
* Payment
* Messaging
* Alerts
* Spender activity

Build desktop/tablet experiences for:

* Business management
* Scheduling
* Analytics
* Geographic analytics
* Bulk management

Required screens:

PERSONAL:

* My Taps
* Add Tap
* Tap Profile
* Tap Settings
* Payment Settings
* Messaging Settings
* Social Links
* Tap History
* Analytics
* Security
* Notifications
* Spender Activity

BUSINESS:

* Dashboard
* Tap Points
* Tap Details
* Assignments
* Schedule
* Employees
* Locations
* Transactions
* Messages
* Analytics
* Geographic Analytics
* Products
* Profiles
* Social
* Security
* Audit
* Settings

---

## 37. DATABASE / DATA MODEL

Extend existing VACO models wherever possible.

Create only missing VASH TAP entities.

Logical entities:

VashTap
VashTapType
VashTapEmbed
VashTapWear
VashTapPoint
VashTapAssignment
VashTapSchedule
VashTapEvent
VashTapProfile
VashTapSocialLink
VashTapAnalytics
VashTapAuditLog

Reuse existing:

User
Identity
Business
Employee
Location
Transaction
Wallet
Notification
Message
Product
Service
Event
Profile

Recommended Tap fields:

tap_id
external_identifier
tap_type
status
owner_identity_id
business_id
location_id
object_type
object_id
current_assignment_id
activated_at
deactivated_at
metadata
created_at
updated_at

Assignment:

assignment_id
tap_id
assigned_identity_id
business_id
location_id
object_id
start_at
end_at
recurrence_rule
status
created_by
created_at
updated_at

Follow existing VACO naming conventions if different.

---

## 38. API REQUIREMENTS

Build APIs following existing VACO API conventions.

Required capabilities:

TAP:

* Create
* Read
* Update
* Activate
* Deactivate
* Archive

RESOLUTION:

* Resolve Tap
* Current assignment
* Context
* Profile
* Actions

ASSIGNMENTS:

* Create
* Update
* Cancel
* Current
* Future
* History
* Conflict detection

SCHEDULE:

* Create
* Update
* Delete
* Read

PAYMENTS:

* Attribute transaction
* Tap transaction history
* Tap revenue
* Business revenue
* Performer/object revenue

MESSAGING:

* Start
* Send
* Reply
* Read
* Permissions

PROFILE:

* Read
* Update
* Business association
* Service association
* Event association

SOCIAL:

* Add
* Remove
* Enable/disable by context

PRODUCT:

* Product association
* Product profile
* Product discovery
* Product ordering integration using existing commerce systems

ANALYTICS:

* Revenue
* Transactions
* Tips
* Taps
* Products
* Objects
* Employees
* Performers
* Locations
* Events
* Geographic analytics

SECURITY:

* Freeze
* Unfreeze
* Lock
* Unlock
* Authorization
* Audit
* Suspicious activity

---

## 39. SECURITY / PRIVACY

Use existing VACA, VASH and QVAN security.

Never store sensitive financial data directly on an NFC tag.

Physical NFC identifier should be only an endpoint identifier.

Financial authorization occurs through VASH/VACO.

Support:

* Authentication
* Authorization
* Encryption according to existing VACO standards
* Rate limiting
* Fraud detection
* Suspicious activity
* Tap locking
* Tap freezing
* Lost/stolen Tap
* Audit trails
* Transaction verification
* Privacy controls
* Message controls

---

## 40. LOST / STOLEN TAP

Owner can immediately:

* Freeze Tap
* Disable Tap
* Revoke assignment
* Stop new protected transactions
* Stop messaging where appropriate
* Preserve historical records
* Reissue/reassign according to VACO rules

Do not require the user to freeze their entire VASH account unless security conditions require it.

---

## 41. NFC HARDWARE ABSTRACTION

Do not hard-code VASH TAP to one NFC manufacturer.

Support compatible passive NFC hardware.

Possible physical formats:

* Silicone
* Fabric
* Elastic
* Leather
* Plastic
* Metal-compatible construction
* Garment inlay
* Adhesive inlay
* Sew-in inlay
* Encapsulated inlay

Passive NFC does NOT continuously broadcast location.

VASH TAP can track:

* Taps
* Transactions
* Assignments
* Usage
* Events
* Analytics

Continuous location tracking requires other hardware and must not be falsely represented as an NFC capability.

---

## 42. BUSINESS / PERSONAL ANALYTICS

Every authorized user gets analytics appropriate to their role.

PERSONAL:

* My Tap revenue
* My transactions
* My Tap activity
* My messages
* My follows
* My product activity
* My spending/receiving
* My Tap security

BUSINESS:

* Business revenue
* Tap revenue
* Location revenue
* Employee revenue
* Performer revenue
* Product revenue
* Service revenue
* Event revenue
* Geographic analytics
* Tap utilization
* Customer/tapper aggregates
* Messaging activity
* Product conversion

---

## 43. GEOGRAPHIC ANALYTICS

Build an analytics/map layer using existing VACO location infrastructure.

Authorized business users can analyze:

* City
* Market
* Location
* Venue
* Event
* Tap Point

Allow filters:

Revenue
Transactions
Tips
Tap count
Customers/tappers
Time period
Business
Tap
Product
Employee
Performer

Privacy rules must prevent unnecessary exposure of individual customer information.

---

## 44. AUDIT LOG

Audit:

* Tap creation
* Activation
* Deactivation
* Assignment
* Reassignment
* Scheduling
* Ownership
* Business association
* Profile changes
* Social changes
* Payment configuration
* Messaging permissions
* Security actions
* Freeze/unfreeze
* Lock/unlock
* Product association

Record:

* Who
* What
* Previous value
* New value
* Date/time
* Tap ID
* Business/location
* Authorization context

---

## 45. TESTING

Use the existing VACO test framework.

Test:

TAP CREATION

* Create
* Update
* Activate
* Deactivate

TAP RESOLUTION

* Correct Tap
* Correct assignment
* Correct business
* Correct profile
* Correct context

ASSIGNMENT

* Schedule
* Recurring schedule
* Conflict
* Override
* Expiration
* History

PAYMENT

* Successful
* Failed
* Pending
* Reversal
* Refund
* Correct Tap attribution

ALERTS

* Payment notification
* Message notification
* Assignment notification
* Security notification

MESSAGING

* Send
* Reply
* Permissions
* Block
* Business-hours restriction

SOCIAL

* Add
* Remove
* Display
* Permissions

PRODUCT

* Tap product
* View product
* Add to cart
* Purchase integration
* Attribution

ANALYTICS

* Tap revenue
* Product revenue
* Outfit revenue
* Employee revenue
* Performer revenue
* Location revenue
* Geographic analytics
* Comparison

SECURITY

* Unauthorized access
* Unauthorized assignment
* Unauthorized analytics
* Lost/stolen Tap
* Freeze
* Lock
* Audit

FRONTEND

* Tap profile
* Business dashboard
* Spender dashboard
* Assignment manager
* Analytics
* Product profile
* Security
* Mobile responsiveness

---

## 46. REQUIRED RUNNABLE DEMO

Build a genuine runnable demonstration using development/seed data only.

DEMO BUSINESS:

HUNT Barber Shop

Tap Points:

Chair 1
Chair 2
Chair 3
Chair 4
Chair 5

Assign different demo barbers.

DEMO ENTERTAINER:

Maya

Taps:

Black Performance Outfit
Red Performance Outfit
Gold Performance Outfit
Vault Studios Costume
VIP Event Outfit

DEMO PRODUCT:

DEGVCHI Jacket

Embedded VASH TAP

Demonstrate:

* Tap resolution
* Profile
* Payment
* Phone notification
* Message
* Social links
* Follow
* Product discovery
* Product ordering flow
* Dynamic assignment
* Scheduling
* Analytics
* Revenue attribution
* Geographic attribution
* Spender history
* Security controls
* Freeze/unfreeze
* Lock/unlock
* Tap limits
* Historical assignments

---

## 47. SMOKE TEST

Actually run the application.

Verify:

1. Create Tap.
2. Register Tap ID.
3. Activate.
4. Assign Tap.
5. Resolve Tap.
6. Display profile.
7. Execute permitted payment.
8. Confirm actual VASH transaction.
9. Generate phone alert.
10. Send message.
11. Receive message.
12. Record analytics.
13. Reassign Tap.
14. Confirm history.
15. View Tap analytics.
16. Compare Taps.
17. Apply Tap limit.
18. Lock Tap.
19. Unlock Tap.
20. Freeze Tap.
21. Confirm blocked protected action.
22. Unfreeze.
23. Test spender history.
24. Test product Tap.
25. Test social/profile links.
26. Test business dashboard.
27. Test geographic analytics.
28. Test security/audit.
29. Run all tests.
30. Run frontend smoke test.
31. Run production build.
32. Verify no regressions in existing VACO apps.

---

## 48. PERFORMANCE

Tap resolution must be fast.

Optimize:

* Tap lookup
* Context resolution
* Profile loading
* Payment initiation
* Notification delivery
* Analytics queries

Index:

* Tap ID
* Transaction attribution
* Business ID
* Location ID
* Assignment
* Date/time

Use pagination and appropriate caching.

Do not compromise transaction integrity for speed.

---

## 49. SCALABILITY

Support:

One user
→ multiple Taps

One business
→ thousands of Taps

One employee
→ multiple assignments

One Tap
→ many historical assignments

One event
→ many Tap Points

One location
→ many Taps

VACO
→ potentially millions of Tap interactions

Architecture must be scalable.

---

## 50. FUTURE-READY ARCHITECTURE

Prepare clean interfaces for:

* Additional NFC hardware
* QR fallback if desired
* BLE
* Smart jewelry
* Smart clothing
* Smart accessories
* VASH TAP READY manufacturers
* Enterprise device management
* Hotels
* VENVS
* Vulture events
* Vault Studios
* HUNT
* VOID hubs
* VACAY
* CVNVO
* Other VACO businesses

Do not build speculative systems unnecessarily.

---

## 51. VASH TAP READY MANUFACTURER SYSTEM

Prepare the architecture for manufacturers to embed VASH TAP into:

* Clothing
* Handbags
* Wallets
* Accessories
* Uniforms
* Equipment
* Merchandise
* Products

Future designation:

VASH TAP READY

The customer can activate the embedded Tap after purchase.

---

## 52. MASTER USER EXPERIENCE

The VASH TAP experience is:

TAP
→ IDENTIFY
→ RESOLVE CONTEXT
→ VERIFY
→ DISPLAY PROFILE
→ PAY / TIP / ACCESS / CHECK-IN / SHOP / ORDER
→ CONFIRM
→ PHONE ALERT
→ MESSAGE
→ FOLLOW / CONNECT
→ ANALYTICS
→ REVENUE ATTRIBUTION
→ BUSINESS/PERSONAL DASHBOARD

---

## 53. FINAL ARCHITECTURE

VASH TAP
= Physical interaction layer

VASH TAP PERSONAL
= Personal wearable/card

VASH TAP WEAR
= Clothing/accessory NFC

VASH TAP EMBED
= Standalone NFC inlay

VASH BUSINESS TAP
= Business-managed endpoints

VASH TAP POINT
= Physical station/location/object

VASH TAP CONTROL CENTER
= Management + scheduling + analytics

VASH TAP ANALYTICS
= Revenue + activity + geographic attribution

VASH TAP SECURITY
= Tap-level controls integrated with VACO/QVAN

VASH TAP COMMERCE
= Physical-object product discovery and ordering

VACA
= Identity + verification

VASH
= Financial/payment layer

VCOIN
= Existing VACO economic/settlement layer where applicable

VACO
= Shared platform infrastructure

QVAN
= Existing security/fraud infrastructure

VACO NOTIFICATIONS
= Phone alerts

VACO MESSAGING
= DMs/messages

VACO ANALYTICS
= Analytics infrastructure

---

## 54. DEFINITION OF DONE

VASH TAP IS NOT COMPLETE UNTIL:

[ ] Backend exists
[ ] Database integration exists
[ ] APIs exist
[ ] Frontend exists
[ ] Personal Tap exists
[ ] Business Tap exists
[ ] Wear Tap exists
[ ] Embed Tap exists
[ ] Tap Points exist
[ ] Dynamic assignment exists
[ ] Scheduling exists
[ ] Payment attribution exists
[ ] Phone alerts work
[ ] Messaging works
[ ] Social links work
[ ] Profiles work
[ ] Follow/connect works
[ ] Product discovery works
[ ] Product ordering integration exists
[ ] Tap analytics work
[ ] Revenue attribution works
[ ] Outfit/object analytics work
[ ] Business comparisons work
[ ] Geographic analytics work
[ ] Spender activity works
[ ] Spender security works
[ ] Tap ON/OFF works
[ ] Scheduling controls work
[ ] Tap limits work
[ ] Lock/unlock works
[ ] Freeze/unfreeze works
[ ] Security monitoring works
[ ] Audit logs work
[ ] Plaque customization architecture exists
[ ] Business management exists
[ ] Personal management exists
[ ] Tests pass
[ ] Frontend smoke tests pass
[ ] Production build passes
[ ] Application runs
[ ] Existing VACO systems are reused
[ ] No unnecessary duplicate infrastructure was created
[ ] Existing VACO regression tests remain healthy

---

## 55. FINAL CLAUDE CODE COMMAND

DO NOT JUST EXPLAIN HOW TO BUILD VASH TAP.

INSPECT THE EXISTING VACO REPOSITORY.

IDENTIFY WHAT ALREADY EXISTS.

REUSE IT.

IMPLEMENT EVERYTHING MISSING FOR VASH TAP.

BUILD THE BACKEND.

BUILD THE FRONTEND.

CONNECT THE DATABASE.

CONNECT VASH.

CONNECT VACA.

CONNECT VCoin WHERE APPLICABLE.

CONNECT EXISTING NOTIFICATIONS.

CONNECT EXISTING MESSAGING.

CONNECT EXISTING SECURITY/QVAN.

CONNECT EXISTING ANALYTICS.

CONNECT EXISTING BUSINESS/EMPLOYEE/LOCATION SYSTEMS.

BUILD THE TAP ASSIGNMENT ENGINE.

BUILD THE SCHEDULING ENGINE.

BUILD THE TAP CONTROL SYSTEM.

BUILD THE SPENDER EXPERIENCE.

BUILD THE BUSINESS EXPERIENCE.

BUILD TAP-TO-SHOP.

BUILD PRODUCT ATTRIBUTION.

BUILD GEOGRAPHIC ANALYTICS.

BUILD REVENUE ATTRIBUTION.

BUILD CUSTOM PLAQUE CONFIGURATION.

BUILD THE SECURITY CONTROLS.

WRITE THE TESTS.

RUN THE TESTS.

RUN THE APPLICATION.

RUN THE FRONTEND SMOKE TEST.

RUN THE PRODUCTION BUILD.

FIX ERRORS.

VERIFY THE COMPLETE END-TO-END WORKFLOW.

DO NOT LEAVE PLACEHOLDERS WHERE A REAL VACO SYSTEM ALREADY EXISTS.

DO NOT DUPLICATE COMPLETED VACO INFRASTRUCTURE.

DO NOT STOP UNTIL VASH TAP IS A REAL, RUNNABLE FEATURE INSIDE VACO.

VASH TAP IS THE PHYSICAL-TO-DIGITAL COMMERCE, PAYMENT, IDENTITY, COMMUNICATION, SECURITY, AND ANALYTICS LAYER FOR THE VASH/VACO ECOSYSTEM.

BUILD IT.
CONNECT IT.
TEST IT.
RUN IT.
VERIFY IT.

END MASTER FREEZE.
