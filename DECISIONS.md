# Notes on how I built DealerPulse

## The short version

You gave me a file with 510 leads across five branches, thirty sales people and
seven cars. I could have turned that into a wall of charts. I did not, because a
wall of charts makes you do the work.

Instead the first thing you see is a sentence. It says what is wrong, who it is
about, and roughly what it costs you. Everything under that sentence is there so
you can check it.

Here is the sentence the data actually produced.

> Lakeside converts 7.6 percent of its leads where the group converts 31.4
> percent, and the break is at the very first step. 42 percent of Lakeside leads
> are never called.

Nobody typed that. The code looks at every branch, finds the one furthest behind
its peers, walks its funnel step by step, works out which step loses the most
leads, and writes the sentence from what it finds. If you upload different data
next month it will write a different sentence, or it will tell you there is
nothing worth saying.

## Who I imagined using it

I kept picturing a busy person opening this on a phone between two meetings. He
has about ninety seconds. He wants to walk out with one thing he can say to a
branch manager on a call.

That single idea decided most of the design.

It decided that the finding goes at the top in big type instead of at the bottom
in a summary box. It decided that the money is shown right next to the problem
rather than three clicks away. It decided that a chart only earns its place if it
answers a question the finding creates.

It also decided what I left out. There is no vanity dashboard, no gauge, no
speedometer, no chart that exists to look busy.

## The money is a range, and I want you to know why

Most dashboards give you one confident number. I give you two.

Take the 8.59 crore sitting in the money at risk panel. That is 38 orders where
somebody has already paid and the car never left the lot. The oldest one has been
sitting for 195 days. Normal is 17 days.

Now, how much of that will you actually recover? Honestly, nobody knows. If your
team chases every one of them, most will complete. If nobody chases them, many
will not. So instead of pretending, the product shows a low figure and a high
figure and tells you what separates them.

The same thinking runs through the whole product. Where a number depends on an
assumption, the assumption is on screen, not buried in a footnote.

## Sometimes it refuses to answer

This is the decision I am most pleased with.

If a branch has too few leads to judge fairly, the product will not print a
percentage for it. It shows a dash instead. If too many branches are too small to
judge, it will not name a worst branch at all. It says so plainly and tells you to
widen the date range.

A rate on four leads looks exactly like a rate on four hundred once you print it
as a percentage. That is how dashboards mislead people without lying. So there is
a floor. Ten leads before it will show a rate, thirty before it will accuse a
branch of being the problem. A branch too small to judge is also too small to let
off the hook, which is why the whole finding is withheld rather than pointed at
whoever happens to be big enough.

## Time is frozen on purpose

Your data ends on 31 December 2025. So the product treats that date as today.

This matters more than it sounds. If I used the real clock, then every age, every
overdue flag and every idle counter would drift a little further from the truth
every day, and a lead that is 195 days late today would quietly become 400 days
late by next summer. Freezing the clock means the same link shows the same numbers
whenever you open it, which is what you need if you are going to share one.

There is a small dot in the top bar that says when the data is current. Click it
and it explains exactly this. I would rather say it out loud than let somebody
assume the numbers are live.

## Two ways to read a date range, and they are both right

This one took me a while to get right, and I think it is the most useful thing in
the product.

Ask for the last quarter and there are genuinely two answers.

One answer is what happened in those three months. Cars handed over, money
collected, work done. That is the number a CEO usually means.

The other answer is how the leads you took in those three months converted. Some
of them will not deliver until March. That is the number you need if you are
judging whether your intake is any good.

Most dashboards silently pick one and never tell you. This one lets you switch
between them with a single button, and the label always says which one you are
looking at. On the same quarter the two answers were 24.81 crore and 17.55 crore.
Both correct. Very different conversations.

## The part that tells you what to do today

The overview tells you what is wrong. The Act now screen tells you what to do
about it, in order.

It is a work queue. Paid orders with no delivery record sit at the top because
that is money you have already taken. Under that are leads going cold, ranked by
how long they have been quiet against what is normal for that stage. The
thresholds come from your own data rather than from a round number I made up.
Seven days sounds sensible until you notice that seven days at one stage is
perfectly normal and at another stage it means the deal is dead.

You can tick items off, and it remembers. You can snooze one and it comes back.
There is an undo. Small things, but a queue you cannot mark off is not a queue,
it is a list.

## It works on a phone properly

Not shrunk. Rebuilt.

On a desktop a table is a table because you are comparing rows. On a phone a
table is a trap, because eight columns in 393 pixels means either the header
scrolls away or the number does, and then you are reading a figure with no idea
what it measures.

So below 768 pixels every table becomes a stack of cards. Each card puts the
name and the headline number on one line, then every other figure carries its own
label. The label is the same word as the column header, taken from the same place
in the code, so the two can never drift apart.

Tablet gets its own treatment too. Not the phone layout stretched, and not the
desktop layout squeezed.

## Things I decided not to build

I want to be straight about this, because a list of everything I added is not
very honest on its own.

I did not build a column picker for the lead table, because the table already
drops the right columns by itself at each screen size and a control that mostly
repeats that is just another button.

I did not build a guided tour. If the product needs a tour to explain a single
sentence in large type, the sentence is not doing its job.

I did not build a what has changed since you last visited marker, even though it
is a nice feature, because your data is a fixed export. It would have been
theatre.

I also removed a row spacing control I had built, because when I looked at it
properly it saved about twelve percent of height and added a button that looked
like a menu. Not worth it.

## How I know it actually works

Two layers.

The first is a set of thirty three checks that recompute every headline number
straight from your raw file and compare it against what the product says. Not
against a saved copy of the answer, against the source. If a change ever moves
the delivered revenue, the conversion rate or the money at risk, those checks fail
immediately. They have run on every single change I made.

The second layer opens a real browser and looks at the product the way you would.
It loads 32 different views at four screen sizes in both light and dark, and it
checks the things that are invisible in a code review. Does anything overflow the
screen. Is every column heading actually sitting above its own data. Is every
button big enough to hit with a thumb. Is every piece of text readable against its
background, measured properly rather than eyeballed. Does every page have a
heading and its own name in the browser tab.

That second layer earned its keep. It found a bug where a two pixel decoration I
had added to table rows was quietly pushing every row one column across from its
own header, on every table, on every screen size. It looked fine on a laptop
because there was room to absorb it. On a phone it put the customer name over the
value column, which is exactly what you spotted in your screenshot.

It also caught text that was too faint to pass accessibility standards, chart dots
that were nearly invisible against the background, and two pages that had no
heading at all.

Both layers are in the repository. Run npm test for the numbers and npm run audit
for the browser checks.

## What I would do next

If this were going into real use, three things.

First, connect it to a live source instead of a file, and unfreeze the clock once
there is something to keep it honest.

Second, let people save and share views with each other rather than only in their
own browser. The plumbing is already there because every filter lives in the web
address.

Third, sit with an actual branch manager for an hour and watch which screen they
open second. I have a strong guess. I would rather know.
