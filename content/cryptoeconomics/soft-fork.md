---
title: "Soft Fork"
date: "2025-12-02"
source_url: "https://stacker.news/items/1298972"
---

# A soft fork is a 51% attack on Bitcoin 

A 51% attack can happen when a miner gets a majority of hashpower and is able to control the blockchain by refusing to build on valid blocks from other miners. A miner with a majority of hashpower can do this because we expect them to be able to produce a chain with the most work more quickly than the rest of the miners, thus orphaning blocks found by other miners. 

A coalition of miners with a majority of the hash power can achieve the same effect. In fact, this is what happens every time we implement a soft fork.

# Hard forks vs soft forks

You've probably heard the difference between hard forks and soft forks described like this: hard forks loosen block validation rules while soft forks tighten them. While this is a popular description, it doesn't always help us think about what is actually happening.

# Your node can enforce a hard fork, even if the majority of the network disagrees with you 

For a hard fork, nodes that run old software and don't update to the new rules will reject blocks that have transactions following the new rules. This is because the new rules are an expansion: some transactions that weren't previously valid now are. There is no way for old nodes to know about these rules unless they run new software. The choice is update or fork. 

> Under a hard fork, new nodes think old-style blocks are invalid, and old nodes think new-style blocks are invalid. Thus if old nodes continue creating old blocks, we get a chain of old blocks, and a chain of new blocks. Each community thinks theirs is the one true blockchain. [-Nate Eldredge](https://bitcoin.stackexchange.com/questions/75543/why-is-a-softfork-unable-to-divide-the-network)

If there is a chain split, it's fairly straightforward: the nodes and miners who like the new rules will end up on one chain and the node and miners who don't like the new rules will end up on another chain.

# Your node must follow a soft fork if the majority of hashpower enforces it

In the case of a soft fork, nodes that don't run updated software with the new rules will still see blocks that follow those rules as valid. Old nodes won't reject blocks on the chain following the soft fork rules because the new rules are a subset of the previous rules. 

> Under a soft fork, new nodes think old-style blocks are invalid, but old nodes think both types of blocks are valid. New miners, which we assume are in the majority, will create a chain of new blocks only. Old miners may try to create old blocks within this chain, but since new miners won't accept those blocks, they'll get orphaned. The old nodes will think the old miners are just unlucky, and they'll continue to accept the longest chain of blocks which they consider valid. [-Nate Eldredge](https://bitcoin.stackexchange.com/questions/75543/why-is-a-softfork-unable-to-divide-the-network)

Even if there are miners still producing blocks that follow the old rules, old nodes won't recognize those blocks unless they are also part of the longest chain. So what determines whether a soft fork is implemented is if the majority of hash power enforces it.

# An op_return soft fork example

Imagine there is a soft fork that imposed this new rule: transactions can no longer include op_returns. If you don't run these new rules on your node, you can still stay on the chain that is following the new rules, it may just look like no one is making those kind of transactions anymore. 

But what would happen if you created a transaction with an op_return in it? 

None of the new nodes would relay the transaction because they don't think it's valid. But, perhaps there are still enough old nodes out there for your transaction to make it to a miner (it doesn't take many). 

If the miner is running the new rules of the soft fork, they won't mine your transaction because they don't think transactions can have op_returns in them. But if you reach a miner who hasn't updated their software to the new rules of the soft fork, they very well may include your transaction in a block.

Now we have a problem: all the nodes that *are* running the new rules of the soft fork won't accept this block as valid. 

As far as you are concerned, this isn't much of a problem: all nodes can do is reject blocks that don't follow their rules. No skin off your nose. 

But it may be a problem for the miner who mined your transaction. Miners who *are* running the new rules of the soft fork will throw out the block with your transaction in it because they don't think it's valid. They will keep building on the previous block and if there are enough of them, they'll build new blocks faster than the old miner and the block with your transaction will be orphaned. It all comes down to how many miners are using the new soft fork rules.

And now it may become a problem for you: if a majority of the hash rate refuse to build on the block containing your op_return transaction, it won't become part of the chain with the most work. Even worse: your node won't think there's anything wrong with this. 

# We need a 51% attack to enforce the soft fork rules

For a soft fork to be successful, a majority of the hash power must be enforcing the soft fork. In such a case, the miners who enforce the rules of the soft fork can refuse to build on top of a block that is mined by a miner who isn't following the soft fork.

This is exactly what a 51% attack looks like: a majority of hash power refusing to build on valid blocks.

*I've been reading [Cryptoeconomics](https://github.com/libbitcoin/libbitcoin-system/wiki/Cryptoeconomics) again, and this is an attempt to work through the definition of "Soft Fork" in the Glossary, which I am copying below.* 

---

# Cryptoeconomics: [Soft Fork](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#soft-fork)

> A [Fork](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#fork) that implies a [Split](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#split) unless [Enforced](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#enforcement) by [Majority Hash Power](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#majority-hash-power). Contraction of the set of potentially-[Valid](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#validity) [Blocks](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#block).
