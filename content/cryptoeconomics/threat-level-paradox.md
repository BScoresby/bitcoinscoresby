---
title: "Threat Level Paradox"
date: "2025-01-23"
source_url: "https://stacker.news/items/861152"
---
# Mining pools can exclude transactions if they want to

You may have heard rumblings that some pools are not including OFAC-sanctioned transactions in the blocks they are building. Recently, @0xB10C wrote a very thorough analysis of [15 transactions that were not included in blocks](https://b10c.me/observations/13-missing-sanctioned-transactions-2024-12/) when, based on fee rates, we might have expected them to be. While b10c did not conclude that all 15 transactions were censored, it seems likely that at least one pool (F2Pool) was specificaly excluding OFAC-sanctioned transactions.

This isn't the first time [F2Pool has done this](https://b10c.me/observations/08-missing-sanctioned-transactions/). Indeed, the [pool founder said](https://b10c.me/observations/08-missing-sanctioned-transactions/#update-2023-11-23) they "have every right" to "refuse to confirm transactions for those criminals."

He's right: mining pools can exclude whichever transactions they want from the blocks they build.

# Mining pool centralization

While we're at it, let's talk about another worrying trend in mining: mining pool centralization. Here's a chart of the blocks over the last week and which pool mined them:

![](https://m.stacker.news/74227)

In the past there have been mining pools representing larger fractions of the total hashrate, but the current situation certainly isn't something to be happy about, especially if pools find it convenient to work together.

Speaking of working together, perhaps you remember [another article 0xB10C wrote](https://b10c.me/observations/12-template-similarity/) about how a number of pools seemed to be using the same template as AntPool.

Consolidation of mining pool rewards also seems to indicate centralization among mining pools. @mononautical pointed out that [at least 9 pools were using the same custodian](https://x.com/mononautical/status/1777686545715089605) for their coinbase transactions.

Of course, just as it's up to a pool to decide which transactions they mine, it's up to a hasher to decide which pool they work with.

# The "Hope hashers are nice to us" security model

So, we have two problems:

1. Mining pools are following government orders to exclude transactions from blocks.

2. Mining pools seem to be consolidating.

Put together, you might wonder what would happen if a mining pool (or group of pools) that censors gets more than 51% of the hash power.

More than just excluding transactions from their own blocks, would they refuse to build on top of blocks that included OFAC-sanctioned transactions?

Another way to phrase the last part of this question is to say that the big CensorPool reorgs the chain[^3] any time another miner produces a block that includes transactions the CensorPool wants to censor. CensorPool only has this ability [as long as they maintain majority hashpower](https://bitcoin.stackexchange.com/questions/120446/can-the-two-biggest-bitcoin-mining-pools-lock-out-all-others). So, usually, people answer the question by saying if such a horrible thing happened, hashrate would leave the big, censoring pool and go to other pools that weren't so big and didn't censor.

[^3]: In the case where CensorPool has a strong majority of hashpower, this may just look like an increased number of stale blocks; however, it's not like nodes typically keep track of when the abandon a block for a longer chain, and to my knowledge [there is no easy way](https://bitcoin.stackexchange.com/questions/80275/data-about-number-of-block-mined-stale-blocks-per-day-in-bitcoin) to make sure we actually notice all the stale blocks that occur. Luckily, there are more obvious tells:there would be a marked increase in transactions that were not making it into blocks even though we might expect them to. In the case of the 15 transactions that 0xBC10 looked at, all of them made it into the next block.

However, we have to assume that hashers were pointing their hash at the big pool because it made the most sense for them. If our pretend CensorPool is only excluding a few transactions here and there, do we really think that enough hashers will leave the pool to make a difference? Especially in the case where it is clear that CensorPool has majority hashpower and defecting hashers only reap a benefit if they break the majority.

It seems likely that in doing so hashers would be incurring some loss of profit (at least because of switching costs, but likely also due to payout structure or pool size, as well as the increased risk that not enough hashers defect to break CensorPool's majority) and switiching is definitely not in their immediate best interest -- possibly not in their interest at all.  

Does Bitcoin's security model in this situation rely on nothing more than the altruistic feelings of hashers? Hoping that hashers will do "the right thing" even when it's contrary to their immediate best interest?

# The "Richie Rich" security model

But we have missed a vital piece of this puzzle. Those sad little OFAC-sanctioned transactions are still sitting there, feeling like nobody wants to play with them. So sad!

If your transaction isn't getting confirmed, what do you do? You offer to pay more to get it mined.

A pool like F2Pool can refuse to include any transaction they like, but if they don't maximize revenue, their payouts will not be as good as the payouts of the pools that do include such higher-fee-rate transactions.

Once mempools begin to fill up with high-fee-rate transactions, we don't have to rely on the altruistic feelings of hashers anymore; the chance to mine extra-juicy censored transactions definitely makes it in a hasher's interest to switch to a non-censoring pool.

# Censors fix this

Imagine the worst case scenario from up above: a mining pool or consortium of pools controls more than 51% of the hashrate ***and*** excludes OFAC-sanctioned transactions from their blocks ***and*** they refuse to build on blocks that contain such transactions.

In theory, here's how it plays out:
- at first, the transactions might simply sit in mempools.
- When it's obvious they aren't getting mined, their owners might try increasing the fee-rate of their transactions.
- Perhaps a minority hashpower mining pool sees some of these higher-fee rate transactions and tries to mine them, but their block is pretty quickly turned into a stale block by CensorPool reorging it.
- The high-fee-rate transactions really begin to pile up. If enough transactions with high enough fee-rates are just waiting in mempools for everyone to see, the incentive for CensorPool hashers who want to make more money becomes stronger, perhaps strong enough to induce a chunk of them to break away from CensorPool.

And *voila!*: in yet another brilliant stroke of genius, Satoshi not only created a system where censorship produces the conditions for its own undoing -- but also simultaneously creates one of the few decentralizing pressures in mining. Any time a mining pool tries to exclude certain kinds of transactions it necessarily produces an incentive for hashrate to leave the pool.

If we end up with big pools, let's hope they try to censor! Because if they don't, the only defense we have against miner centralization is hoping that hashers "do the right thing."

# A flaw in the brilliance

Unfortunately, there is a flaw here: there were only 165 OFAC-sanctioned transactions in 2024, and 378 such transactions in 2023.[^1] If such a scenario were to play out today, I'm not sure there is enough passed-over fee revenue to incentvize anyone attempting something like breaking away from a pool with dominant hash power.

[^1]: Once again, @0xBC10 is a huge resource on this. They maintain [a list of OFAC sanctioned bitcoin addresses](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses/blob/lists/sanctioned_addresses_XBT.txt) so you don't have to download [the list yourself](https://ofac.treasury.gov/sanctions-list-search-tool) and sort it for Bitcoin addresses.

For hashers to try to split away from a pool or group of pools with 51% or more of the hashpower, they would need to be pretty confident that the big pool wasn't going to be able to reorg them. The bigger the pot of fees to be gleaned from censored transactions, the stronger such decentralizing pressure becomes.[^2]

[^2]: As a side note, it's interesting to think about how mempool filtering (trying to censor transactions at the mempool and relay policy level) fails to produce this same result -- mostly because it just isn't very effective. Even if 70% of listening nodes censor your transaction and refuse to relay it, [you still have a 95% chance](https://lists.linuxfoundation.org/pipermail/bitcoin-dev/2022-October/021116.html) that at least one of your outbound peers accepts and passses it on. For a censor to effectively censor transactions at the relay level, they would need to be running a vast majority of the nodes on the network. And even in that situation, miners interested in mining such transactions could always advertise a means of direct submission (email, webform, etc...). If there are miners who want to mine the transactions, it's very difficult to stop them from learning about them. If you have 51% of the hashpower though, it becomes a more realistic project to prevent their inclusion in a block.

Strangely enough, [Bitcoin is stronger when more transactions are censored](https://github.com/libbitcoin/libbitcoin-system/wiki/Threat-Level-Paradox).

*I've been reading [Cryptoeconomics](https://github.com/libbitcoin/libbitcoin-system/wiki/Cryptoeconomics) again, and this is an attempt to work through some of the ideas in the chapter called "Substitution Principle" which I am copying below.*

--- 

# Cryptoeconomics: [Threat Level Paradox](https://github.com/libbitcoin/libbitcoin-system/wiki/Threat-Level-Paradox)

As implied by the [Zero Sum Property](https://github.com/libbitcoin/libbitcoin-system/wiki/Zero-Sum-Property), presumably the only way to defeat [external subsidy](https://en.wikipedia.org/wiki/Subsidy) is to [mine](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#mine) at a capital loss relative to [market](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#market) return on capital. Similarly it seems that only way to defeat tax, up to and including a 100% tax (prohibition), is to mine beyond the reach of the taxing authority, such as in secret. As with all [black markets](https://en.wikipedia.org/wiki/Black_market) there is an increased cost to [subversive mining](https://www.theatlantic.com/magazine/archive/2017/09/big-in-venezuela/534177). Competing against subsidized mining compounds the cost.

If one accepts the [Axiom of Resistance](https://github.com/libbitcoin/libbitcoin-system/wiki/Axiom-of-Resistance) one must assume that both tax and subsidy will be used to reduce the cost of [controlling](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#power) Bitcoin. Using the power to subsidize mining (via tax revenues), [states](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#state) can cause [pooling](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#pooling) in the region of the subsidy. Once [majority hash power](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#majority-hash-power) is focused the state can use its taxing (regulatory) power in the region to compel [censorship](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#censorship).

Therefore in order to enjoy the benefits of a hard currency, it would seem that [people](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#person) will ultimately have to mine at a loss. However, censorship creates the opportunity for others to mine profitably to the extent that people are willing to offset this cost with [fees](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#fee). This black [market](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#market) is Bitcoin's censorship resistance. People pay a higher price for certain transactions, and in order to maintain that higher price the state must also suffer the expense, despite its ineffectiveness.

**Paradoxically, this tool works well when money is under attack and poorly otherwise.** If there was no *internal* [pooling pressure](https://github.com/libbitcoin/libbitcoin-system/wiki/Pooling-Pressure-Risk) these cases would be balanced. But [risk distribution](https://github.com/libbitcoin/libbitcoin-system/wiki/Risk-Sharing-Principle) is essential to subversive mining, and pooling pressure works *against* distribution. So there is ever-expanding [attack surface](https://en.wikipedia.org/wiki/Attack_surface) with no pressure to contract unless effective monetary alternatives are suppressed. The [suppression](https://en.wikipedia.org/wiki/Foreign_exchange_controls) of alternatives raises [reward](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#reward) [utility](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#utility) to the miner in the region of suppression. The paradox applies as well to [centralization pressures](https://github.com/libbitcoin/libbitcoin-system/wiki/Centralization-Risk).

The expected consequence is that Bitcoin will not be well prepared for [attacks](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#attack) because it is financially disadvantageous for [people](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#person) in a low threat environment.
