---
title: "The $5 wrench"
date: "2026-04-20"
source_url: "https://stacker.news/items/1475275"
aliases: 
  - $5 wrench
  - wrench attack
  - wrench attacked
  - rubberhose cryptography
  - rubberhose cryptanalysis
  - $5 wrench attack
  - wrench
---

# Don't talk about your #&%ing stack

Jameson Lopp maintains the most comprehensive list of [known physical Bitcoin attacks](https://github.com/jlopp/physical-bitcoin-attacks/blob/master/README.md). The first name on the list is Hal Finney, who was [swatted in 2014](https://archive.is/WvHB9), months before he passed away. Since then, Lopp has recorded more than 300 physical attacks on Bitcoiners. Lopp himself was [swatted in 2017](https://archive.is/p5gEf), but most of the attacks on his list are what Bitcoiners lovelingly refer to as "wrench attacks." This is a euphemism for someone coming and beating the shit out of you because they think it will convince you to hand over the keys to your coins.

# But, like, who uses a wrench?

I, myself, have often wondered this. There are many household tools a villain might employ in their efforts to inflict trauma on a body. Some famous examples you might be familiar with include: knives, lead pipes, ropes, candlesticks, revolvers, and so on. I highly doubt that a wrench is the first thing that comes to mind when one is carefully planning an extortion attempt. And yet...here we are, talking about wrench attacks.

The first time the term was used on BitcoinTalk was in July of 2011 when thechevalier replied to a thread about ["Portable Bitcoin Security"](https://bitcointalk.org/index.php?topic=28567.msg361586#msg361586).

[![](/assets/memeology/wrench1.avif)](/assets/memeology/wrench1.avif)

thechevalier references an xkcd comic, which is also referenced in the first, slightly earlier [(25 April 2011)](https://x.com/nipsespin/status/62600916104261632), use of the term "wrench attack" on Twitter. [A comment](https://www.schneier.com/blog/archives/2009/10/evil_maid_attac.html) on a *Schneier on Security* post from October 2009 about evil maids, suggests that readers pay heed to "XKCD’s advice about the $5 wrench attack." And the term shows up on Hacker News as early as [July 2009.](https://news.ycombinator.com/item?id=681881)

# xkcd #538: Security

[![](/assets/memeology/wrench2.avif)](/assets/memeology/wrench2.avif)

This xkcd comic, titled *Security*, was published on 2 February 2009. By all accounts, xkcd is the source for the term "$5 wrench attack." Still, we have to wonder: who uses a wrench? How big a wrench could you get for $5 in 2009?

Well, I did a little research on that. In January 2008, you could get a 3-piece wrench set for $4.49 at [Harbor Freight](https://web.archive.org/web/20080120074446/http://www.harborfreight.com/cpi/ctaf/Displayitem.taf?itemnumber=47099). So it is entirely possible that one was able to get a beefy wrench (at least a 12" crescent wrench or something comparable) for under $5.

[![](/assets/memeology/wrench3.avif)](/assets/memeology/wrench3.avif)

A 12-inch steel wrench is a formidable weapon. But I don't think Munroe was solely inspired by the blunt-force qualities of hand tools. In addition to cheap hand tools, Randall Munroe, who writes xkcd, also clearly had a fondness for cryptography:

[Legal Hacks](https://xkcd.com/504/)

[![](/assets/memeology/wrench4.avif)](/assets/memeology/wrench4.avif)

[Alice and Bob](https://xkcd.com/177/)

[![](/assets/memeology/wrench5.avif)](/assets/memeology/wrench5.avif)

[Cryptography](https://xkcd.com/153/)

[![](/assets/memeology/wrench6.png)](/assets/memeology/wrench6.png)

So it's likely that Munroe was familiar with the work of Bruce Schneier and possibly even the Cryptography mailing list, where a solution to this problem had been discussed at length as

# Deniable encryption

The same day that xkcd published *Security*, a person using the name Ax0n published [a post](https://www.h-i-r.net/2009/02/rubber-hose-cryptanalysis-and-how-to.html) on the HiR Information Report Blog describing "how not to get a wrench to the head." The blog post begins with xkcd's comic, but goes on to discuss a deniable encryption project called [TrueCrypt](https://archive.is/CeLI0).

TrueCrypt 1.0 was [released](https://groups.google.com/g/alt.comp.freeware/c/0zrb7f3ysVg/m/kBbirQtgIekJ) on 2 February 2004. It claimed to be "the only free open-source on-the-fly encryption software capable of encrypting partitions larger than 2 GB under Windows XP/2000." But what really sets TrueCrypt apart is that it offered users plausible deniability.

In the case where a person decides to encrypt their files, it is likely that an idiot will ask "What have you got to hide?" and if that idiot happens to be a government official who has power over you, it would be handy to be able to say, "I've got nothing to hide" and decrypt a decoy set of files. But of course, you wouldn't want to do this if the government official could prove that you hadn't fully decrypted your files.

Suelette Dreyfus [describes](https://web.archive.org/web/20041014134144/http://iq.org/~proff/rubberhose.org/current/src/doc/maruguide/t1.html) deniable cryptography like this:

> Deniable cryptography gives a person not wanting to disclose the plaintext data corresponding to their encrypted material the ability to show that there is more than one interpretation of the encrypted data. What deniable crypto means in the Rubberhose context is this: if someone grabs your Rubberhose-encrypted hard drive, he or she will know there is encrypted material on it, but not how much -- thus allowing you to hide the existence of some of your data.

The TrueCrypt [user guide](https://www.uvm.edu/~ddeutl/TOEC2010/TrueCrypt/TrueCrypt%20User%20Guide.pdf) says it has a solution to this that involves:

> 1. Hidden volumes (for more information, see the section Hidden Volume below).
> 2. It is impossible to identify a TrueCrypt volume. Until decrypted, a TrueCrypt volume appears to consist of nothing more than random data (it does not contain any kind of "signature"). Therefore, it is impossible to prove that a file, a partition or a device is a TrueCrypt volume or that it has been encrypted. However, note that for system encryption, the first drive cylinder contains the (unencrypted) TrueCrypt Boot Loader, which can be easily identified as such (for more information, see the chapter System Encryption)

TrueCrypt [was based](https://medium.com/@niraj.lal/rubberhose-cryptography-and-the-idea-behind-wikileaks-julian-assange-as-a-physics-student-4fd0578cbaa3#:~:text=Rubberhose%20Cryptography%20formed%20the%20kernel%20of%20TrueCrypt) on an earlier cryptography project by Julian Assange called Marutukku which was published in 1997.

# Marutukku known by another name

The documentation for Marutukku dwells [at length](https://github.com/MerlijnWajer/rubberhose/blob/master/doc/beatings.txt) on the problems faced by a user of encryption, such as the one featured in xkcd's comic:

> Ordinarily best strategy for the rubber-hose wielder is to keep on beating keys out of (let us say, Alice) indefinitely till there are no keys left.

This sounds an awful lot like the method proposed in the xkcd comic. The only difference is the implement (a rubber hose -- which curiously enough is the name by which this project became known: [Rubberhose](https://web.archive.org/web/20031206045542/http://www.iq.org/~proff/rubberhose.org/)).

Assange designed a program that made it impossible for the rubber-hose wielder to ever be sure that they had gotten all the keys from their target.

> However, and importantly, in Rubberhose, *Alice* can never prove that she has handed over the last key. As Alice hands over more and more keys, her attackers can make observations like "the keys Alice has divulged correspond to 85% of the bits". However at no point can her attackers prove that the remaining 15% don't simply pertain to unallocated space, and at no point can Alice, even if she wants to, divulge keys to 100% of the bits, in order to bring the un-divulged portion down to 0%. An obvious point to make here is that fraction-of-total-data divulged is essentially meaningless, and both parties know it - the launch code aspect may only take up .01% of the total bit-space.

While this is clever, what we are most interested in, is why Assange was so obsessed with rubber hoses.

# Rubberhose cryptanalysis

Years before Assange published Rubberhose, the term was being used in cryptography circles. The earliest use I could was by Marcus Ranum in October, 1990. In a thread about ["Cryptography and the Law"](https://web.archive.org/web/20240402041852/https://groups.google.com/g/sci.crypt/c/W1VUQlC99LM/m/ANkI5zdGQIYJ?pli=1) Ranum says:

> You still don't get The Master Plan, unless you resort to the rubber-hose technique of cryptanalysis. (in which a rubber hose is applied forcefully and frequently to the soles of the feet until the key to the cryptosystem is discovered, a process that can take a surprisingly short time and is quite computationally inexpensive)

Aha! This again sounds a lot like the xkcd's wrench usage. But did you catch the difference?

The current discussion about wrench attacks assumes the villains in xkcd's comic are thieves or criminals, but for the most part, everybody in the history of the term assumed the threat was government employees.

The wrench attack meme reminds us that we live in a physical world and that there are often simple, physical measures one can take to dramatically improve one's security. But it should also remind us from where the real threat comes:

# your government hates you.
