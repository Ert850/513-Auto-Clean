# For the next report to Elijah

Items to include the next time we send Elijah an update. Remove each one once it's been sent.

## Git history was rewritten on November 26 (photo GPS removed)

- Seven job photos (and twelve older versions of the before/after photos) carried the GPS location of where they were taken, in the public repository since June. That location is the customer's driveway. Emmett approved removing it from the whole history, and every branch on GitHub was rewritten that evening. The site itself didn't change.
- **Action for Elijah and his agent:** any copy of the repository from before November 26, 8 PM Eastern is out of date. Before working on `eNov6` (or any branch) again: fetch, then reset the branch to `origin/eNov6`, or clone again. Pushing from an old copy would put the GPS photos back.
- **Still to do, not sent yet (Emmett's call):** GitHub keeps its own copy of every pull request's commits, so the old photos are still reachable through the 13 pull requests until GitHub Support clears them. The request asks GitHub to remove cached views and the `refs/pull/*` references for the repository's rewritten commits. Emmett will decide when to send it.
- New photos: `photo-gps.test.ts` fails the tests if a committed photo has GPS. Strip it first (`exiftool -gps:all= photo.jpg`).
