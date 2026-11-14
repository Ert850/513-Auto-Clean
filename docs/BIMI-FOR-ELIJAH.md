# The logo beside our name in the inbox (BIMI): what it takes and costs

**Elijah's question:** can the picture next to "513 Auto Clean" in a customer's inbox be our logo, instead of a grey icon?

**Short answer:** yes, through a standard called **BIMI**, but it costs about **$650 to $1,750 a year**, takes a few weeks, and only some mail apps show it. The logo **inside** the email is already done (on the test branch). That one is free.

## Where we are today (checked November 14)

- **Booking emails** come from `bookings@513autoclean.com` through Resend, which is signed correctly (DKIM).
- **513autoclean.com has no DMARC record.** That's the rule that tells inboxes what to do with mail that fails its checks. BIMI needs one at full strength.

## The steps

1. **Add a DMARC record in "monitor" mode** (`p=none`, with reports). Free, and good for deliverability anyway. Leave it 2 to 4 weeks, and read the reports to find every service that sends as `@513autoclean.com`: Resend today, and GoHighLevel once Imperion connects it.
2. **Make sure every sender is set up correctly:** Resend now, GoHighLevel when it starts sending. **This is the risky part.** If step 3 happens before a sender is set up, that sender's emails go to spam or bounce.
3. **Tighten DMARC to `p=quarantine` or `p=reject`**, for all mail.
4. **Prepare the logo as a special square SVG** ("SVG Tiny PS"). A one-time job.
5. **Buy a mark certificate** from a certificate authority:
   - **CMC (Common Mark Certificate):** no trademark needed, but the logo must have been in public use for about a year. About **$650 to $1,400 a year** (Sectigo is around $990 direct and about $650 through resellers; DigiCert about $1,100 to $1,400).
   - **VMC (Verified Mark Certificate):** needs a **registered trademark** for the logo (USPTO filing, months), then about **$750 to $1,750 a year**. Only a VMC earns Gmail's blue checkmark.
6. **Publish the BIMI record** in DNS, pointing at the logo and the certificate.

## Who would see it

| Mail app | With a CMC | With a VMC |
|---|---|---|
| Gmail (web and phone) | logo | logo + blue checkmark |
| Apple Mail (iPhone, Mac) | sources disagree; plan on no | logo (Apple has been reported to accept only DigiCert's) |
| Yahoo / AOL | logo | logo |
| Outlook | no | no |

## Recommendation

- **Do step 1 now** (DMARC in monitor mode). It's free, safe, and needed for everything else.
- **Wait on the certificate** until the business is sending more email (GoHighLevel reminders and campaigns). Then a CMC through a reseller is the cheaper route, if the logo has a year of public use by then.
- **Ask Imperion** whether GoHighLevel will send as `@513autoclean.com`. If so, it has to be in place before DMARC is tightened.

**Questions for Elijah:** when did the bottle logo first go public (website, Google, Instagram)? Is there a registered trademark?

## Sources (pricing changes often; some are vendor sites; get a current quote before buying)

- [Gmail Blue Checkmark: what BIMI actually costs in 2026](https://guptadeepak.com/guides/gmail-blue-checkmark-bimi/)
- [List of BIMI VMC and CMC certificate providers and prices](https://www.suped.com/learn/bimi/list-of-bimi-vmc-and-cmc-certificate-providers-and-prices)
- [BIMI certificate cost for CMCs and VMCs](https://www.thesslstore.com/resources/bimi-certificate-cost-for-cmcs-and-vmcs/)
- [VMC and CMC certificates for BIMI: how to choose, buy and deploy](https://www.captaindns.com/en/blog/bimi-vmc-cmc-certificate-guide)
- [Differences between CMC and VMC, including cost and requirements](https://www.suped.com/learn/dmarc/what-are-the-differences-between-cmc-and-vmc-certificates-including-cost-and-requirements)
- [Sectigo Verified Mark Certificates](https://www.sectigo.com/ssl-certificates-tls/verified-mark-certificate)
