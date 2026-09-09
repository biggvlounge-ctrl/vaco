# YAP — Review Platform Comparables

Written to close a comparables-coverage gap. YAP had no comparables
document at all.

**What it is:** green-flag / red-flag reviews of people, deliberately
decoupled from CVNVO's matching engine.

## Comparables

| Platform | What it reviews | The lesson |
|---|---|---|
| **Yelp** | Businesses | Review platforms live or die on fraud resistance. Yelp's filtering is its actual product; the reviews are the raw material. |
| **Glassdoor** | Employers, by employees | Demonstrates that reviewing a *party with power* is defensible in a way reviewing an individual is not. |
| **Rate My Professor** | Individuals, by students | The closest structural analogue, and a cautionary one: persistent documented problems with bias and retaliation. |
| **"Are We Dating The Same Guy"** | Individuals, by daters | The direct analogue for YAP's actual use case — and the subject of real, active defamation litigation. |

## The honest position

**This is the highest-liability product in the ecosystem, and it is not
close.** Every other compliance concern here — securities, gambling,
cannabis, likeness — is a licensing or clearance problem with a known
process. This one is a defamation exposure with no registration that
makes it safe.

The last comparable is the important one. Groups doing exactly what YAP
does are being sued by the people they review, and the outcomes are
genuinely unsettled. Section 230 protects a platform from liability for
what users post, but it does not protect the users themselves, and it
does not protect a platform that materially contributes to the content.

**What follows from that, concretely:**

- **The decoupling from matching is a real safety property, not an
  architectural preference.** If a red flag on YAP suppressed someone
  in CVNVO's matching, YAP would stop being a place where users publish
  opinions and start being an input to a decision the platform makes
  about a person. That is a meaningfully worse legal position. The
  decoupling is built and should stay built.
- **A dispute and removal path is not optional.** Yelp and Glassdoor
  both have one. Not currently built.
- **This needs Deskins before launch, not after.** Alongside the
  Cvltvre Card influencer question, this is the second item where the
  right move is a legal review rather than an engineering decision.

## What is genuinely built

Green/red flag reviews, real routes, persisted, discoverable, and
genuinely decoupled from matching.

## Not built

Dispute/appeal flow, removal process, identity verification of
reviewers, and any fraud or brigading resistance. Every comparable
above has all four, and the ones that added them late did so under
pressure.
