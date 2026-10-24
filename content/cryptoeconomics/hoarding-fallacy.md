---
title: "Hoarding Fallacy"
date: "2025-11-03"
source_url: "https://stacker.news/items/1272935"
---

# Pay me in bitcoin

Right off the bat, let's talk about this: the only time you as a node-running Bitcoiner can enforce the rules of Bitcoin is when you are receiving a payment. When you receive a payment, you can use your node to check if the coins someone gives you follow the rules of Bitcoin as you understand them. If they don't, you can refuse to accept the payment.

As a Bitcoiner, this is your big moment. This is the first and main reason you might want to run a node. It's pretty awesome to be able to determine the veracity of money someone offers you based on nothing other than the math done by your computer. 

The rest of the time, your node is mostly just checking to see if there are any new payments belonging to your wallet, downloading and validating blocks, and relaying blocks and transactions. But if your power goes out and your node is offline for a while, nobody cares. 

# Nodes don't care about invalid blocks

Now let's imagine you are a serious hodler. You have a nice stack but you are not actively acquiring any bitcoin at the moment. All you're doing is running your node, tinkering with your mempool configuration and hodling...are you enforcing the rules of bitcoin?

Well, you might say your node is downloading new blocks and deciding whether they are valid, so surely there is some amount of "enforcing the rules" going on here. If somebody sends your node an invalid block, your node will just throw it in the garbage and move on...rules enforced!

I'm not so sure. 

# If a fork falls in the forest and no one rejects a payment, does it actually fork?

Let's think about the situation where there actually is a fork. Imagine some people decided to add a few rules to Bitcoin and they get some miners to mine blocks with these new rules. For instance, one of the new rules might be that op_returns can be no larger than 84 bytes. 

This sounds like a good rule to you, and so you update your node to run this rule. What happens if some miner who is following the old rules where op_returns could be bigger mines a block with such a transaction? Well, your node will see it as invalid and toss it and keep waiting for a new block that extends the chain and is valid...rules enforced!

If a miner mines a new block that does follow the rules for smaller op_returns, there will be a chainsplit; two different chains of blocks will extend from one point. But your node doesn't see any of that. As far as nodes go, forks don't exist. All your node sees is the chain with the blocks it calls valid. The other chain doesn't exist. The same is true for nodes on the other chain with regard to your node. The block data you relay is just garbage to them.

Merely downloading and validating blocks is a solitary[^1] activity. It doesn't affect anyone else. When *can* your node affect other people? When they try to pay you.

[^1]: It is true that your node relays blocks to other nodes and so it's a not true to say that it is an entirely solitary enterprise, but the spread of information is asymmetrical -- one node can broadcast to thousands -- and your node's little voice in spreading the information is not vital.  

# What it looks like to try to pay someone on a different fork

Here's a thought experiment: how would it look different to nodes on the other side of the fork if your node had crashed right before the block with a bigger op_return came along? 

Now imagine if someone who was using a node that followed the old rules of Bitcoin tried to pay you. Let's pretend this is a while after such a fork happened and they are using coins they received in a block after the fork happened.

You could give them an address and they could sign a transaction sending coins to it. When this transaction gets mined by miners on their fork, their node will see it as confirmed. 

Your node, on the other hand, will not show you the transaction at all. When it hears about the transaction it throws it out because the utxos don't exist as far as it is concerned. And this is the moment where you tell them that they still haven't paid you. They can holler and scream all they want, but if your node doesn't see the transaction, it doesn't exist and they haven't paid you. Now you are enforcing the rules of Bitcoin.

# If you can't reject a payment, you can't enforce rules.

*I've been reading Cryptoeconomics again, and this is an attempt to work through some of the ideas in the chapter called "Hoarding Fallacy" which I am copying below.*

---

# Cryptoeconomics: [Hoarding Fallacy](https://github.com/libbitcoin/libbitcoin-system/wiki/Hoarding-Fallacy)

There is a theory that an increased level of [hoarding](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#hoard) produces an increased level of security in a [coin](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#coin). This is the similar to the [Dumping Fallacy](https://github.com/libbitcoin/libbitcoin-system/wiki/Dumping-Fallacy) but is not necessarily based on a [split](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#split).

The presumed security benefit to an elevated level of hoarding stems from the theory that an [owner](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#owner) has a say in [validation](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#validation) and could act to prevent the [economy](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#economy) from accepting what the owners collectively consider [invalid](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#validity) money. However owners are not acting unless they [trade](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#trade) [units](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#unit) for something, and in this case it is the [merchant](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#merchant) who enforces [consensus rules](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#consensus-rules). **The possibility that owners could act in unison does not increase this zero level of control. The theory is therefore invalid.**

An increase can only be described relative to some base level. If a [person](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#person) can be convinced that there is increased system security in a higher collective hoarding level, the theory holds that the person may decide to hoard more than would otherwise be optimal (i.e. the person's base level). This amounts to an actual individual cost with a presumed socialized benefit. In other words the theory depends on irrational economic behavior, even if the security benefit is actual, and is therefore invalid.

The theory implies that less trade in the coin will produce greater security. This is the opposite of the case. As shown in [Qualitative Security Model](https://github.com/libbitcoin/libbitcoin-system/wiki/Qualitative-Security-Model), consensus rule enforcement requires ongoing trade. The [price](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#price) of a unit of the coin [in another good](https://github.com/libbitcoin/libbitcoin-system/wiki/Inflation-Principle) or money is arbitrary, but rises temporarily if individuals are convinced to engage in the fallacy. The benefit of this increase accrues to existing owners. The theory that price can only rise is a related [speculative](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#speculate) error explored in [Lunar Fallacy](https://github.com/libbitcoin/libbitcoin-system/wiki/Lunar-Fallacy). Even a provable perpetual general price rise would not validate this theory, as it relates only to a temporary relative increase caused by financially sub-optimal individual decisions.
