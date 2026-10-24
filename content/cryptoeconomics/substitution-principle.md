---
title: "Substitution Principle"
date: "2025-11-19"
source_url: "https://stacker.news/items/1286449"
---


# The more people who use bitcoin, the less useful it becomes

This may not sound right to you, but let's think it through: in order to use bitcoin (even if your use case is hodling in cold storage) you need to acquire bitcoin. This means someone must make a transaction that transfers bitcoin to you and this transaction must be confirmed in a block on the chain with the most proof of work. 

In order to do that, someone is going to have to pay a transaction fee. It doesn't matter if you are buying bitcoin from a stranger in an alley or from a kyc'd exchange, the fee must come from the sender. But it's likely they will pass that fee on as a cost to you. 

Clearly, there are fee rates at which it no longer makes sense for you to buy the amount of bitcoin you were planning on buying. Because bitcoin fees are not based on the number of sats transferred, but the number of bytes required by the transaction, you might decide to wait to make your purchase of bitcoin until you can buy more sats. There may even be a fee level at which you decide it's not worth it to buy bitcoin at all.

Bitcoin is unique among moneys for this property that it costs more to use as more people try to use it.

# What stops somebody from just copying the code and starting another bitcoin?

When something gets expensive in a free market, there is an incentive for people to make an alternative that is cheaper. 

One of the earliest (and most unthoughtful) gotchas people have thrown at Bitcoin is that since the code is open source "there's no reason somebody can't just start a new one." 

While it is true that many people *have* started new coins, it's also become clear why this doesn't work very well: Bitcoin has a massive infrastructure built around it (hash rate, wallets and other tools, lightning, and a well developed network of users) and any new coin that wants to fulfill a similar utility -- even as a cheaper substitute -- has to overcome very high startup costs. 

It's not very easy to jumpstart a new coin. This is why so many altcoins are shitcoins.

# If things like Ark, Spark, Liquid, and ecash aren't BTC, they must be altcoins

We've all struggled with describing the new payment solutions that have been showing up in Bitcoin the last few years. Mostly, I've seen people comparing them to Lightning: calling them layer twos and talking about how they have slightly different trust assumptions. 

For instance, it is clear that ecash has no unilateral exit to bitcoin -- if the mint doesn't want to give you bitcoin for your ecash tokens, there's really nothing you can do about it. 

Spark has the possibility of unilateral exit to bitcoin -- but only if you have enough bitcoin to pay the on chain fees and leave yourself with a worthwhile UTXO. And if you want to use it with Lightning, it seems like you are trusting the channel owner at some point. Ark is similar.

These trade-offs have led to a lot of confusion: is a vUTXO the same as bitcoin? Are sats in Spark the same as sats on Lightning?

I wonder if we wouldn't do a better job of explaining these things and understanding them ourselves if we just called them altcoins and accepted that they are a market response to the cost of transacting on bitcoin. 

# Stablecoins pegged to bitcoin

Except, they aren't *just* altcoins -- ecash tokens are supposed to have the same value as sats and the same goes for vUTXOs in Ark. So, really, what we are working with is a stablecoin that is pegged to bitcoin. 

Like a stablecoin issuer, mint operators and Spark entities are promising to "back" the tokens they give you with bitcoin at a 1 to 1 ratio. You have some assurances that this will be the case (indeed, much better than the assurances afforded by stablecoins that attempt to be pegged to fiat currencies), but it's not a guarantee. 

# Does this apply to Lightning?

I don't think so. Lightning duplicates most of the assurances of bitcoin. In order to use Lightning, you need to open a channel. Anyone can open a channel, and in opening a channel, you have strong protections to get your sats back onchain.  

To use ecash or Ark or Spark, you don't have to run a mint or an ark or a Spark entity -- but this also means that there is a fundamental difference between these things and Lightning: we've shifted from a permissionless protocol to a permissioned protocol.

*I've been reading [Cryptoeconomics](https://github.com/libbitcoin/libbitcoin-system/wiki/Cryptoeconomics) again, and this is an attempt to work through some of the ideas in the chapter called "Substitution Principle" which I am copying below.*

--- 

# Cryptoeconomics: [Substitution Principle](https://github.com/libbitcoin/libbitcoin-system/wiki/Substitution-Principle)
A [substitute good](https://en.m.wikipedia.org/wiki/Substitute_good) is one that can be used in place of another. As the [price](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#price) of a product rises, at some level [people](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#person) either move to substitutes or cease use altogether.

While a substitute would be less desirable at the same price as the original product, its lower price offsets this preference. In this manner the presence of substitutes reduces demand for the original good. The substitute competes with the original just as does increased [supply](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#supply) of the original.

Given that a [coin](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#coin) has fixed supply, it is commonly assumed that no supply side increase can reduce upward price pressure. As shown in [Stability Property](https://github.com/libbitcoin/libbitcoin-system/wiki/Stability-Property), Bitcoin integrates transfer [fees](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#fee) which necessarily rise with use. This unique characteristic creates downward price pressure by reducing demand. **But this rising cost also makes substitutes viable, creating downward price pressure by effectively increasing supply.**

There is nothing preventing the evolution of multiple similar coins. It is possible for these to exhibit nearly indistinguishable monetary properties, minimizing the substitution tradeoff. As shown in [Consolidation Principle](https://github.com/libbitcoin/libbitcoin-system/wiki/Consolidation-Principle), there is always pressure toward a single money, as this eliminates the [exchange](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#exchange) cost. However this pressure is at odds with rising costs, and at some level of use must give way to substitution (or disuse).

There is a theory that since creation of new coins costs nothing, the substitution principle implies that Bitcoin must become worthless due to unlimited free supply. This ignores the fact that Bitcoin requires people pay to use it. This is as true for a second coin as it is for the first.

And increasing supply relieves demand. At some point demand is not sufficient to produce/secure more supply, and as such the theory is invalid. This is the same relationship that holds with commodity monies and indeed all products.
