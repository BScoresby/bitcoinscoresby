---
title: "Relay Fallacy"
date: "2026-02-26"
source_url: "https://stacker.news/items/1442845"
---

# The problem with Bitcoin is that mining pools tend to get bigger

In Bitcoin mining, there's a number of reasons to get in a pool. Two of these reasons are variance and latency.

- **Variance.** A miner working by themselves has to wait until they find a block to get paid (really, they have to wait until they find a block and then wait another 100 blocks because block subsidies can't be spent immediately). But all along (perhaps long before they actually get any bitcoin), they have to pay power bills and whatever other bills they have. This is called variance. If you work with a pool, maybe you can find blocks more frequently and help each other by splitting the rewards. 
- **Latency.** Miners also have this problem where the longer it takes them to learn about a new block, the worse off they are. If you have a miner and you're grinding along trying to find a block but you don't know there's already a new block that's been found and all the other miners are building on top of that one, you might be wasting your hash power. You want to be building on a new block as soon as you possibly can. However long it takes you to learn about a block is the size of your disadvantage. If you work with a pool, especially a big one, maybe they can help cut down the latency (every time your pool finds a block, you learn about it very quickly -- the bigger your pool, the more likely they are to find blocks).

Because of these two reasons, and things like economies of scale, large pools have an advantage over smaller miners operating on their own -- which means smaller miners have an incentive to join pools, which means mining pools tend to get bigger.

# Big pools are big bad

Everybody knows that one of the major risks for Bitcoin is a 51% attack. If one entity gains control of more than half the mining power, the censorship resistant properties of Bitcoin begin to weaken. You have probably seen a chart of the share of hash rate wielded by various pools. Lately it looks like this:

[![](/assets/cryptoeconomics/relay1.avif)](/assets/cryptoeconomics/relay1.avif)

Foundry USA has found just over 30% of the blocks in the last month. You probably also read @0xB10c's [report from 2024](https://b10c.me/observations/12-template-similarity/) that a number of other pools seemed to be receiving block templates from Antpool and that this group (Antpool and Friends) may represent an aggregation of hash power rather larger than is represented by the tradition of self-reporting in a coinbase transaction when they find a block. The only solace in the face of this seemingly dire centralization is that at least there are lots of small pools. Maybe other small miners will join them.  

# Does having more mining pools make things better?

While having lots of pools seems like a good thing, if you think about it, it doesn't actually fix the problem. Whether there are three pools or thirty, individual miners still have to work against variance and latency and those miners who join bigger pools will still have an advantage. 

It might be a lovely world where there are ten different mining pools spread across the world each with ten percent of the hash power, but we would expect the same pressure towards centralization in that lovely world as there is in our Foundry-and-Antpool-and-Friends-dominated world. More pools might seem like it is better for censorship resistance, but nothing about having more pools changes the incentives point toward larger pools getting larger. 

Indeed, I would expect more pools to always tend to aggregate into less pools. Maybe local regulations or the proclivities of the mining operators get in the way of this centralization, but one thing that I don't think gets in the way is having more pools to choose from.

# What if we fix the latency problem?

Recently, Localhost Research [announced](https://lclhost.org/blog/fibre-resurrected/) that they are reviving the [FIBRE network](https://bitcoinfibre.org/) (https://stacker.news/items/1438268/r/Scoresby). The FIBRE network is a special patch to Bitcoin Core nodes that spreads block information using UDP rather than TCP:

> Bitcoin Core uses TCP, which delivers an in‑order byte stream. Its reliability depends on ACKs and retransmission, so loss can trigger long tail latencies. Moreover, widely deployed loss‑based congestion control favors shorter‑RTT flows, penalizing long‑haul fiber paths that can contribute to block propagation delays. UDP enables one-way push, eliminating TCP’s ordering and retransmission constraints, enabling FIBRE to deliver blocks with latency bound in fiber rather than transport-layer limitations.

Additionally, FIBRE network nodes don't validate blocks before relaying them, which also results in a hefty reduction in latency. When a new block is shared by the peer-to-peer relay network each node has to validate the block header before it will relay the block to other nodes. This is one of the ways the network protects itself from DoS attacks. But this little bit of validation adds latency to the block's propagation such that a small miner who relies solely on Bitcoin's peer-to-peer relay network may wait a little longer to learn about a new block than a large mining pool that is broadcasting new blocks to all its members.

While anyone can run a FIBRE network (just like, in theory, anyone can run a mining pool), such a network is most effective at reducing latency if it has nodes that are geographically dispersed and if it has access to lots of large block producers (so it can learn about blocks as soon as they are found).

The idea is that a small miner could point their node at a FIBRE network node that is nearest to them and learn about blocks as soon as they are found, rather waste time mining on stale tips until they hear about a new block through normal block propagation methods. 

# Is adding a new relay network different than adding a new pool?

In the immediate term, this seems like it will reduce the advantage the large pools have over the small pools. Small pool operators (or small individual miners) will able to connect to the FIBRE network and learn about new blocks with very low latency. 

This ought to increase the profitability of these miners and pools. Which ought to allow them to increase their hash rate. 

However, it seems to me that the FIBRE network doesn't really reduce any of the centralization pressure on mining. It just adds a new wedge to the pie chart. 

I don't see a big difference between Antpool and Friends and the various miners who will connect to a specific FIBRE network (FIBRE and Friends?). In both cases we have an entity upon which miners are relying for an efficiency gain, and which the miners  have to trust to some extent in order to realize that efficiency gain.

The FIBRE website is clear that anyone can run a FIBRE network. And indeed they have made a really good [set up guide](https://bitcoinfibre.org/setup-guide/) should you want to do this, however, it's not clear how this actually reduces a miners incentive to join with a larger group -- it's just a new group for the miner to join. 

*I've been reading Cryptoeconomics again, and this is an attempt to work through some of the ideas in the chapter called "Relay Fallacy" which I am copying below.*

---

# Cryptoeconomics: [Relay Fallacy](https://github.com/libbitcoin/libbitcoin-system/wiki/Relay-Fallacy)

The [peer-to-peer](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#peer-to-peer) network disseminates [blocks](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#block) and [unconfirmed](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#unconfirmed) [transactions](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#transaction). The [protocol](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#protocol) itself allows [nodes](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#node) to protect against [denial of service](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#denial-of-service). Consequently this [communication](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#communication) requires no [identity](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#identity). This protection is how the network avoids the need for permission to participate.

However this protection comes at a cost in terms of [announcement](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#announcement) [latency](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#latency), and because of the [advantage to proximity](https://github.com/libbitcoin/libbitcoin-system/wiki/Proximity-Premium-Flaw), lower latency translates into higher [apparent hash power](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#apparent-hash-power). Therefore [miners](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#miner) compete for reduced latency. One way to reduce latency is [pooling](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#pooling), another is to use a more efficient dissemination network. Given that pooling surrenders [power](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#power) to the operator, presumably the latter option is preferable.

One way to improve dissemination is to _optimize_ the peer-to-peer network. The other is to join a distinct network, called a [relay](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#relay), that has lower latency due to elimination of denial-of-service protections, for [example](http://bitcoinfibre.org/):

> [T]he cmpctblock message format was designed to ensure it fits neatly into a UDP-FEC-based relay mechanism. The only difference is that we send it over UDP with FEC... This way, extra hops do not introduce more latency. Sadly, due to the nature of our FEC encoding, we cannot know if individual packets are a part of a legitimate, or any, block, and thus only enable this optimization between nodes run by the same group.
> 
> _bitcoinfibre.org_

The relay accepts [communication](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#communication) from a set of miners, over the peer-to-peer or other protocol. The relay consists of a set of [machines](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#machine) under the control of the [relayer](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#relayer). It communicates the announcements within its [internal network](https://bitcoinmagazine.com/articles/blockstream-satellite-broadcasting-bitcoin-space) and eventually to the joined miners.

The important security observation is that communication within the relay is under the relayer's control. Due to the removal of denial-of-service protections central control is _necessary_ to the scheme. The relayer can delay certain blocks based on miner, region, [signal](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#signal), non-payment, etc. A relayer sells reduced latency, and is therefore in the mining business. From a security standpoint it matters not if this service is offered for free. Miners may similarly offer [grinders](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#grinder) free reduced latency and [variance](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#variance).

Relays are aggregations of miners and miners are aggregations of grinders. The greater the hash power aggregation, the more profitable is the mine, as is the relay. One may consider that grinders are free to leave mines and miners are free to leave relays, and it is of course possible for a grinder to run his own mine and his own relay. But larger aggregations are more profitable, so leaving the largest relay or mine [increases relative cost](https://github.com/libbitcoin/libbitcoin-system/wiki/Zero-Sum-Property).

A theory holds that relays reduce pooling pressure. This is an error. **Any pooling reduction caused by a relay does not disappear but is transferred to the relay as a pooling increase.** Relay statistics are never presented alongside mining statistics, masking the power transfer. This leads people to believe that mining is less strongly-pooled than is the case. This may lead people to believe that mining is less strongly-pooled than is the case.
