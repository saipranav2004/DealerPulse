# Next feature: Before you make the call

## The gap it fills

The product tells you Lakeside is the problem. Then you pick up the phone, and
the branch manager has three answers ready. Our leads are worse. We sell
cheaper cars. We are short staffed.

Right now you have a number and no answer to any of that.

So the product should argue against its own finding before you walk into the
room. Five checks, run automatically on every finding, each one a real
explanation that would let the branch off the hook.

## What it says today (all verified against the data)

| The excuse | What the data says |
|---|---|
| Our leads come from worse sources | Their own source mix, priced at what the other branches convert, predicts **34.8 percent**. They deliver **7.6**. |
| We sell cheaper cars | Their own vehicle mix predicts **36 percent**. And their average enquiry is slightly **bigger** than the group, ₹24.83 L against ₹24.15 L. |
| We are short staffed | They carry the **lightest load in the group**. 15.8 leads per rep. Eastside carries 25.4 and converts 37 percent. |
| It is one bad rep | No. All five reps sit at one or two sales each. Never called runs from 23 to 67 percent across every one of them. |
| Small branch, could be luck | Chance of a gap this size being random is about **1 in 1.4 million**. They would need 23 more cars from the same 79 leads to reach the group rate. |

## It has to be able to clear people too

A test that only ever convicts is not a test. So the same five checks run on
every branch, not just the one the product is complaining about.

| Branch | Actual | Its source mix predicts | Its model mix predicts | Verdict |
|---|---|---|---|---|
| Downtown | 41.2 | 30.3 | 28.1 | Well ahead of its own mix. Worth copying, not fixing. |
| Eastside | 37.0 | 30.3 | 29.8 | Ahead. |
| Highway | 33.0 | 31.0 | 30.8 | Cleared. No case to answer. |
| Central | 31.6 | 28.9 | 31.5 | Cleared. No case to answer. |
| Lakeside | 7.6 | 34.8 | 35.4 | Fails every check. |

Four branches out of five walk away clean, and one of them gets turned into a
lesson for the others instead of a problem. Only Lakeside is left with nothing
to hide behind.

## What is actually new here

The statistics are ordinary. Pricing a branch at somebody else's rates and
testing whether a gap could be luck are both about a hundred years old.

Existing tools do have automated insight features. Power BI has Key Influencers,
ThoughtSpot has SpotIQ. Both of them help you find what might be driving a
number. Neither of them takes the three things a branch manager will actually
say out loud, answers them in his language, and then tells him he is right when
he is right.

That is the new part. Not the maths, the direction. Every other tool helps you
look. This one helps you defend what you found.

## What it costs

Nothing new has to be plumbed in. Every one of these checks runs on data already
sitting in the same file the rest of the product reads. The mix pricing covers 96
to 100 percent of each branch's leads, so there is no thin sample hole in it.

About a day of work.

## Why it matters

It changes what the product is. Today it states a conclusion. This makes it
test its own conclusion and report what survived.

And it cuts both ways. If a check ever came back the other way, the product
would say so and soften the finding itself. A dashboard that can only ever
agree with itself is not handling uncertainty, it is hiding it.
