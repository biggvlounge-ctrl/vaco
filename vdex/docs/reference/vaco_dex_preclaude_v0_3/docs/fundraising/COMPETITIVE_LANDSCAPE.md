# Fundraising competitive landscape — research baseline (November 2026)

This is a feature-category map, not an exhaustive list of every fundraising product worldwide. Product positioning and pricing change; re-verify official vendor terms before decisions.

| Product | Useful benchmark | Design lesson for VASH Fundraising |
|---|---|---|
| GoFundMe | Personal causes and broad crowdfunding | Fast campaign creation, trust/safety and simple sharing |
| Givebutter | Donation forms, events, auctions, P2P, CRM | Unified campaign lifecycle rather than disconnected tools |
| Donorbox | Recurring donations, donor management, P2P | Recurring giving and donor experience |
| Classy / GoFundMe Pro | Nonprofit digital fundraising | Organization-grade campaign management |
| Fundraise Up | Donation checkout optimization, P2P | Reduce checkout friction and support supporter-led campaigns |
| Funraise | Fundraising CRM and P2P | Connect campaign acquisition with donor stewardship |
| Zeffy | Nonprofit fundraising with donor-supported fees | Transparent pricing and fee explanation |
| Bonterra DonorDrive | Event and peer-to-peer fundraising | Team, event and participant workflows |
| OneCause | Event fundraising, auctions, mobile bidding | Events and auctions as campaign formats |
| Qgiv | Donation forms, events, P2P | Configurable campaigns and mobile giving |
| PledgeIt | Pledge/challenge campaigns | Progress-based and activity-linked fundraising |
| Kickstarter | Reward-based project funding | Clear reward tiers and fulfillment obligations |
| Indiegogo | Flexible/fixed project crowdfunding | Distinguish funding models and delivery risk |
| DonorsChoose | Education project funding | Restricted-purpose funding and project updates |
| Give Lively | Nonprofit donation and P2P tools | Accessible nonprofit workflows |

## Core capability checklist to benchmark

Campaign page builder; beneficiary verification; donation checkout; recurring donations; donor CRM; P2P pages; team campaigns; event registration; auction/bidding; text-to-give; matching gifts; receipts; refunds; chargebacks; payout controls; moderation; fraud detection; social distribution; referral attribution; analytics; API/webhooks; accessibility; mobile UX; fee transparency.

## Sources

- Jotform 2026 nonprofit fundraising platform overview: https://www.jotform.com/nonprofit/online-fundraising-platforms-for-nonprofits/
- Givebutter product overview: https://help.givebutter.com/en/articles/1726586-what-is-givebutter-and-how-does-it-work
- Funraise 2026 peer-to-peer platform comparison: https://www.funraise.org/blog/best-nonprofit-p2p-fundraising-platforms-comparison
- Neon One 2026 fundraising platform overview: https://neonone.com/resources/blog/online-fundraising-platforms/
- SEC funding portal registration guide: https://www.sec.gov/files/divisions/marketreg/tmcompliance/fpregistrationguide.htm
- SEC Regulation Crowdfunding intermediary guide: https://www.sec.gov/about/divisions-offices/division-trading-markets/division-trading-markets-compliance-guides/regulation-crowdfunding-small-entity-compliance-guide-crowdfunding-intermediaries
- TikTok Content Posting API: https://developers.tiktok.com/docs/en/content-posting-api-get-started
- LinkedIn Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

## Social integration reality check

TikTok requires app registration, appropriate scopes, user authorization, and app review/audit for public direct posting; unaudited clients can be restricted to private visibility. LinkedIn publishing requires approved permissions and eligible member or organization roles. Meta fundraising features can require the organization to be enrolled in Meta's fundraising tools. Therefore, implement a provider capability registry with API, share-sheet, and manual-link fallbacks instead of promising identical direct publishing on every social network.
