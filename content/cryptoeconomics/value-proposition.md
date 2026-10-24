---
title: "Value Proposition"
date: "2025-10-23"
source-url: "https://stacker.news/items/1263156"
---

# What if Bitcoin *is* for criminals?

I have been listening to old episodes of Bitcoin Uncensored lately, and one of the things that Junseth repeatedly says is:

> People will iterate Bitcoin up to the point it provides regulatory arbitrage and no further 

Unless I'm mistaken, he's saying that the main reason Bitcoin exists is to help people get around laws. We spend so much time defending ourselves against FUD like "Bitcoin is only used by criminals" and "It's just for money laundering" that we forget what it is that Bitcoin actually does: it eliminates the need for trusted third parties in the monetary system. 

> What is needed is an electronic payment system based on cryptographic proof instead of trust, allowing any two willing parties to transact directly with each other without the need for a trusted third party. [Whitepaper](https://bitcoinscoresby.com/whitepaper/)

All this sounds nice and tame unless you really think about it. "Transact directly" means no one is in the way to stop you -- no one *can* stop you. That's the innovation of Bitcoin: every part of it is in service of this use-case.

# Bitcoin is valuable because people want it. But why do people want it?

It is good, sometimes, to ask the question "Why does anyone want bitcoin anyway?" 

The most common answer is probably because people want to make money. But that doesn't tell us much. Money isn't valuable just because it people say it's money. It's valuable because people want it. But why should people want it? What is it useful for?

Well, because there are only 21 million bitcoins. Nobody can make more bitcoin. Given the $38 trillion dollar US national debt, this does seem like a useful quality; inflation sucks and central bank monetary policy often seems a little whimsical. 

On the surface, I'm sure a government could promise to limit the supply of whatever currency they control...but they just never seem to be able to keep their promise. 

And that's the problem: you have to take their word for it. Even if they aren't printing new dollars today, you don't have any way to know if they will print more dollars tomorrow. 

# But how do we know no one can change Bitcoin's 21 million supply cap? 

It's in the code. The function that determines how the block reward halving works also sets the limit on Bitcoin's supply. Unchained has [a very nice explainer](https://www.unchained.com/blog/bitcoin-source-code-21-million) if you want to learn more about it. But the function is simple enough that even a non-developer like me can understand it. Even better, I can download a program, run it on my laptop, and type one command that will verify the total supply of bitcoin at that exact moment. The code is pretty cool.

# And how do we know the code won't change?

Bitcoin has had a number of forks, the consensus code has changed. What makes us so sure a government won't try to force their own change on the code (or that users won't decide to increase supply)?

Unlike any other money on Earth, you can verify the rules of Bitcoin (which is to say you can verify the consensus code) every time you receive a coin. 

When someone offers to pay you Bitcoin and you use your own node to verify the transaction in which they send coins to you, you are enforcing the 21 million supply cap and all the other consensus rules of Bitcoin. You can choose to reject the payment if your node doesn't recognize it as following the rules. 

So this is how we know the code won't change: it won't change as long as _you_ won't change it. 

But is that really why Bitcoin has value? 

Running a program on your computer does not seem like it would be very valuable to anyone else.

# Proof of work makes a program running on one computer valuable to other people

Another one of the rules of Bitcoin is that when your node learns about a new block, it must check to see if this block's header has enough proof of work to meet the current network difficulty target.

This rule may seem like it's not relevant to anything else I've been saying, but it creates the wonderful property that as long as at least half the mining power in the world is not working together to censor you, you have a good chance of getting your transaction included in a block. 

This is because anyone on Earth who has access to energy and mining equipment can attempt to mine the next block. The only rule is that they need to find a transaction header that will double hash to a number that meets the difficulty target. And if they do this, they get to pick the transactions that will go in their block and everyone else probably should accept that block and start building on top of it if they don't want to be left behind and waste their own hash power.

So if the existing miners refuse to mine certain kinds of transactions, the people who want to make those transactions can offer higher and higher fees until some miner decides to include them in a block. 

And this is why Bitcoin is censorship resistant: because you can offer to pay anyone on earth to mine your transaction and anyone on earth can decide it is worth it to do so; and you can enforce this dynamic every time you accept bitcoin in trade by making sure that the coins you are accepting have been included in a block in the chain with the most weight. This is the great innovation of Bitcoin. 

# Bitcoin gives you the option to break the law

In [a recent talk](https://x.com/btcplusplus/status/1979198284787814502), Matt Corallo shared this thing his friend said:

> Bitcoin simply doesn't work unless there's sufficient demand for censorship-resistant transactions in the world.

If only a very few people want the option to break the law, if only a few people want censorship resistant money, it is unlikely this project works. This is because miners only get paid in bitcoin and that bitcoin is only valuable if people will accept it in trade and the only reason you might accept bitcoin instead of any other money is because it has this quality of being a peer to peer money with no trusted third parties -- which is to say, it is censorship resistant.

Satoshi came up with a system for aligning incentives so that we can route around people who try to censor transactions or control the rules of Bitcoin. All the rules of Bitcoin are dependent on this system -- if it doesn't work, all the other things we like about Bitcoin can trivially be altered.

So beware (or be less concerned about what the state will prohibit): Bitcoin is black market money and it is already illegal -- your government just hasn't realized it yet.

*I've been reading [Cryptoeconomics](https://github.com/libbitcoin/libbitcoin-system/wiki/Cryptoeconomics) again, and this is an attempt to work through some of the ideas in the chapter called "Value Proposition" which I am copying below.* 

---
> # Cryptoeconomics: [Value Proposition](https://github.com/libbitcoin/libbitcoin-system/wiki/Value-Proposition)
> The [value](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#value) of Bitcoin over its alternatives derives directly from removing the [state](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#state) from control over both monetary [supply](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#subsidy) and [transaction](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#transaction) [censorship](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#censorship). Advantages include freedom from [seigniorage](https://en.m.wikipedia.org/wiki/Seigniorage), foreign exchange [controls](https://en.m.wikipedia.org/wiki/Foreign_exchange_controls), and [financial surveillance](https://en.m.wikipedia.org/wiki/Know_your_customer). These allow the money to be [transferred](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#transfer) to any [person](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#person), in any place, at any time, without need for third party permission.
> 
> These advantages represent cost reduction through the avoidance of tax. Seigniorage is directly a tax, while foreign exchange controls limit its evasion. The state itself often claims [political independence](https://www.federalreserve.gov/faqs/about_12799.htm) as an objective in the interest of limiting this taxing power. Financial surveillance limits tax evasion more generally. **While Bitcoin cannot eliminate tax, or even necessarily reduce total takings, it represents a change in the nature of taxation.** In any case, for those who consider the state a social good, the option to voluntarily fund it remains.
> 
> It would be an error to assume these advantages flow from the existence of a more efficient technology than employed by [monopoly monies](https://github.com/libbitcoin/libbitcoin-system/wiki/Money-Taxonomy). The technology is far [less efficient](https://github.com/libbitcoin/libbitcoin-system/wiki/Scalability-Principle), yet it [helps people](https://github.com/libbitcoin/libbitcoin-system/wiki/Risk-Sharing-Principle) resist state controls. It is this [resistance](https://github.com/libbitcoin/libbitcoin-system/wiki/Axiom-of-Resistance) that provides the value.
