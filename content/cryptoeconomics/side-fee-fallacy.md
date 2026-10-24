---
title: "Side Fee Fallacy"
date: "2025-11-10"
source_url: "https://stacker.news/items/1278899"
---

# Hey kid, you wanna buy some blockspace?

You've probably heard about so-called "transaction acceleration services" like [MARA's Slipstream](https://slipstream.mara.com/) and [mempool.space's accelerator](https://mempool.space/accelerator). Such services allow you to "accelerate" a transaction by paying the service provider an extra fee to mine your transaction in their next block. 

Pretty much all the big pools except Foundry and Ocean have made such transaction accelerator services available to the public:

- [Antpool txAccelerate](https://www.antpool.com/txAccelerate)
- [SpiderPool txAccelerate](https://www.spiderpool.com/user/loginEmail?redirect=/txAccelerate)
- [ViaBTC BTC Transaction Accelerator](https://www.viabtc.com/en/tools/txaccelerator)
- [f2pool Transaction Accelerator](https://www.f2pool.com/user/tx-acc)
- [Mara Slipstream](https://slipstream.mara.com/)
- [Mempool Accelerator](https://mempool.space/accelerator)

It's interesting to note that Slipstream is the only acceleration service that actually lets you submit a transaction that has not yet been broadcast. I have a feeling many of these other services would allow something similar, but they don't have it formalized on their websites.

# Transaction accelerators are bad, 'mkay

In the course of the debate about filters, an increased use of such acceleration services has been suggested as one possible outcome of stricter relay policies. This, in turn, is suggested as a source of increased miner centralization. 

The argument goes that if people find that broadcasting their transaction to the relay network does not result in it getting mined into a block, they may consider using an accelerator. However, small miners may not have the ability to operate a transaction acceleration service, and even if they do, they probably won't have the same kind of reach to get such a service in front of the public, and so widespread use of accelerators could result in large miners collecting even more fees and growing even larger. 

# "there would be no harm to system security even if all fees were paid off chain"

Eric Voskuil has an interesting take on this theory. He argues that such "side-fee" arrangements (also called "out of band") do not change the fee market:

> If the arrangement deviates from market rates then either the miner or the merchant is accepting an unnecessary loss. This is no different than the miner confirming transactions with below-market on-chain fees or the merchant overestimating on-chain fees, respectively.

At first, I didn't find this argument very convincing. If use of such accelerators is widespread it could likely resemble consistent "overestimation" of on-chain fees, which seems to me that it would be a difference in the market. 

However, that may not actually be the case. Imagine you submitted a transaction at 5 sats/vB and it just languishes in mempools and doesn't get confirmed. This implies that new transactions are appearing with higher fee rates and taking up all the space in newly mined blocks...or that miners are choosing to forgo the
profit they could make from mining your transaction in order to mine less valuable transactions. 

Nevertheless, you decide to submit your transaction to an accelerator and pay them an extra fee. If this fee, combined with the internal fee of your transaction, is less than the prevailing rate making it into blocks, the miner will clearly be taking a loss. If it is more than the prevailing rate making it into blocks, you probably should just have offered that fee-rate to begin with or RBF'd it yourself. 

And if this is the case with one transaction, I don't see why it wouldn't be the case with many. If a "prevailing fee rate" *can* be estimated from looking at mempools and previous blocks, then any deviation from this fee rate will likely come at extra cost either to the miner or to the person who wants their transaction confirmed.

# Prohibition, War on Drugs, Mempool Filters

For a transaction accelerator to sustain their service at rates below what they could get by selecting transactions from mempools would pretty quickly result in that miner losing money and not being competitive.

But the real question is what happens if a transaction accelerator is able to sustain higher than market fee rates collected by their service. 

In the context of the filter debate, transaction accelerators may receive higher than market fee rates because people *can't* get their transactions confirmed any other way. But this implies that at least 92% of the network is refusing to relay such transactions (https://stacker.news/items/1244876)...a situation that seems very difficult to maintain for the case of transactions with sustained economic demand.

Voskuil makes the argument that such a situation is indistinguishable from a state subsidy of mining. He allows that it would distort the mining landscape, but does not see it as a problem inherent to side fee arrangements, but rather to the root cause which makes such a situation possible.

In our example, sustained above-market fees for certain transactions collected by transaction accelerators are potentially caused by aggressive filtering of transactions by more than 92% of the relay network. This presents, I think, another way of describing the idea of filtering transactions via the relay network: it's a way of subsidizing miners who are willing to mine such transactions. 

Perhaps you recall how the US waged a War on Drugs during the 1990s or the Prohibition Era in the 1920s. These aggressive campaigns to "filter" things out of society likely had the result of enriching the people who were willing to break the law. 

Think about how it plays out in the competitive world of mining.

*I've been reading Cryptoeconomics again, and this is an attempt to work through some of the ideas in the chapter called "Side Fee Fallacy" which I am copying below.*

---
# Cryptoeconomics: [Side Fee Fallacy](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy)

There is a theory that off-[chain](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#chain) [fees](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#fee) are illegitimate. The theory holds that a [merchant](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#merchant) paying a [miner](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#miner) "on the side" to [confirm](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#confirmation) the merchant's [transactions](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#transaction) prevents other merchants' transactions from being confirmed, or that it raises the cost of those confirmations.

One impact of such arrangements is that an average _historical_ fee rate cannot be determined through chain analysis. The apparent rate would be lower than the [market](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#market) rate. This could of course lead [spenders](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#spender) to underestimate a sufficient fee. However there is no aspect of Bitcoin that requires future fees to equal some average of past fees. Estimation necessarily compensates, such as by ignoring "free" transactions in full [blocks](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#block) or using [standard deviation](https://en.wikipedia.org/wiki/Standard_deviation) to identify outliers.

Another impact is that disparate relative fee levels can highlight certain transactions as being associated with such arrangements. This can contribute to [taint](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#taint) of the merchant's transaction and/or the miner's [coinbase](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#coinbase). But given the arrangement is a choice made by the creators of these transactions, there is no privacy loss.

There is no impact on market fee rates or the ability of others to obtain confirmations. If the arrangement deviates from market rates then either the miner or the merchant is accepting an unnecessary loss. This is no different than the miner confirming transactions with below-market on-chain fees or the merchant overestimating on-chain fees, respectively.

Furthermore, unless the miner's [hash power](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#hash-power) is 100%, the merchant is increasing his/her average confirmation times by paying a side-fee at what is otherwise a market rate. This implies that the market rate for side fees is the product of the miner's hash power and the prevailing market rate. In other words, proportionally less than otherwise on-chain market rates. Without this understanding one may misinterpret the actual effective rate in such arrangements.

Bitcoin provides a mechanism for on-chain fees so that a transaction can compensate _any_ miner without the use of [identity](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#identity). It is a privacy-preserving convenience. **If miners and merchants want to weaken their privacy by performing additional tasks, there is no basis to consider that illegitimate.** This theory is therefore invalid.

There is a related theory that side fee arrangements constitute a [pooling](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#pooling) pressure. If fees paid are consistent with the market there can be no effect on pooling. Above market fees are a state subsidy, as we must treat the subsidy is not economically rational. Below market fees are a tax, as we must treat the loss as involuntary. These are [distortions](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Glossary#distortion) just like any other state subsidy/tax and are therefore [not unique](https://github.com/libbitcoin/libbitcoin-system/wiki/Side-Fee-Fallacy/Pooling-Pressure-Risk) to side fees. As such the existence of side fees does not create a new pooling pressure and the theory is therefore invalid.
