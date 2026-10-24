---
title: "Thin Air Fallacy"
date: "2026-03-05"
source_url: "https://stacker.news/items/1448148"
---

# How to DIY your own paper bitcoin

My wife doesn't like that we just stack sats and leave them in cold storage. It offends her capitalist sensibilities that we should have a small store of capital that is not being "put to use." I've been hearing a lot about bitcoin loan companies lately, so I finally got brave enough to put two and two together and lend our bitcoin out. 

I'm not looking for a massive return or anything. I'd be happy with something like 8% per year. 

So, we've decided to lend our bitcoin to my wife's business. She doesn't really have any plans for using the bitcoin right now, so I convinced her to leave it in our cold storage until she does, but we're crediting her business with the loan's balance of bitcoin. If we can get her business to generate an 8% return on this loaned bitcoin, we'll feel pretty good about it.

I've also come up with an idea to self-publish this Bitcoin Fixes Fairytales book I've been working on for a while. I'm planning on printing several thousand copies, so it's going to take a bit of capital to get this going. Working off the same principle as we did with my wife's business, we set up a loan of bitcoin from our cold storage. Since I'm still putting the finishing touches on the text, we decided to leave the bitcoin where it is until I'm ready to send it to the printer.

Which is lucky, because we don't actually have enough bitcoin to make both these loans. 

# Did we just create paper bitcoin?

I don't like paper bitcoin. It's like this boogeyman that is haunting us and nobody is really even sure if it exists, but when the price doesn't do what we want, it's because there's all this paper bitcoin floating around on the exchanges. 

When Saylor announces his latest monster buy or we hear about record ETF inflows or there is news of some crazy new "adoption" from tradfi -- and the price doesn't move (or doesn't move enough or moves in the wrong way) everybody says, "See! I told you! It's all that paper bitcoin!" At least, I often feel this way.

But what actually is the consequence of paper bitcoin? 

Let's go back to the toy example from my personal finances. It certainly sounds like I created paper bitcoin. I loaned the same bitcoin out to two different entities at the same time. There may only be the bitcoin I have in my cold storage, but as far as the market sees, there's twice as much. 

Obviously, I haven't actually increased the supply of bitcoin...neither my node, nor any other node notices a difference. And the whole thing only works as long as neither of our businesses actually try to spend the bitcoin they have been loaned. Did we create paper bitcoin? It seems to me that we created a promise to give bitcoin to our businesses -- that is, we created a credit.

# Custodial bitcoin is different than paper bitcoin, right?

You might say that my example is too much a toy. Real paper bitcoin gets created at exchanges that have millions of customers and do lots and lots of trades. In this case, we might change the analogy to look like this:

An exchange holds balances of bitcoin for its customers. When customers want to buy bitcoin, the exchange simply moves some numbers in their database from the people who want to sell (or from a surplus, if they have it) to the people who want to buy. As long as they have enough bitcoin to cover everyone's balances, they aren't creating paper bitcoin. 

If you take a look at any of the major exchanges' terms of service, they usually tell small customers like us that they hold digital assets in "omnibus" accounts or "shared blockchain addresses we control." It is clear from their terms that while you may be the "owner" of bitcoin you hold with them, they control it. You may have something better than an unsecured IOU, but you don't have the bitcoin itself.

As an interesting side note, I found that Coinbase[^1] and Kraken[^2] go so far as to say that you agree to allow them to hold your digital assets on any chain they like and that you will treat all forms of an asset as fungible (ie. wrapped bitcoin on ETH is just as good as onchain bitcoin). 

But Bitcoiners know this: not your keys, not your coins. And so I get the feeling that when we summon the dreaded paper bitcoin boogeyman, we don't just mean bitcoin that we have in a custodial wallet. We mean something more like bitcoin that doesn't exist, that's a fake claim in some way.

# Actually, it's *all* paper bitcoin

Paper bitcoin is like an exchange that uses your bitcoin balance to fund loans to other users, that creates bitcoin out of thin air like a fractional reserve bank. Mostly, exchanges promise not to do this. But even though the terms of service of most of the major exchanges explicitly state that they will not "sell, transfer, loan, hypothecate, or otherwise alienate" your bitcoin, these user agreements are long and sometimes a little tricky. There might be loopholes we aren't thinking about.

If, for instance, an exchange sold more bitcoin to their customers than they actually had access to, we *are* in a paper bitcoin situation. Isn't this the paper bitcoin that distorts price discovery? If people who transfer funds to an exchange but the exchange doesn't use that money to buy more bitcoin (especially when they don't have enough bitcoin in the first place), the market isn't discovering the "real" price of bitcoin. 

As we learned above, exchanges are quite explicit that you don't control the bitcoin they hold on your behalf. So it seems to me that bitcoiner wisdom can help us out here: when you buy bitcoin at an exchange, what you actually have is a claim to bitcoin. Probably it is a stronger claim than an unsecured IOU, but it's still just a claim. It's not bitcoin until you have the keys.

At this point, you might feel like "Duh! that's what everyone means when they say 'paper bitcoin!'" But it's a point that gets lost, I think. All Bitcoin held in custody is paper bitcoin...and that's okay.

# Is paper bitcoin scaring away our number go up?

I'm sure that the extent to which exchanges hold bitcoin to back the claims they sell to us does affect price. But what I come to through this somewhat tortuous thought experiment here is that it's unlikely to affect price for very long. Why do I think this?

There are many exchanges and they have many customers. Some of these customers *do* withdraw their bitcoin (I know, I've done it). At that point, the exchange has to produce real bitcoin. No doubt they have statistical models that predict what percentage of their users will withdraw bitcoin each day. And the fact that they haven't gone out of business yet means that an exchange does have enough bitcoin to meet their customers' demands.

So the first point is that as long as some customers still demand their bitcoin in an onchain address, exchanges cannot create *infinite* paper bitcoin.

The second point is that while paper bitcoin may distort the price in the short run, it's effect probably comes close to vanishing as the market gets used to it. If an exchange knows it only needs to actually hold 10% of the bitcoin it claims to hold for its customers and operates at that level, it will still need to acquire more bitcoin when customers buy more bitcoin on their platform (unless the exchange's appetite for risk changes). 

Paper bitcoin is not bitcoin but as long as exchanges have to settle some claims on chain, the hard limit of 21 million bitcoin still constrains the creation of paper bitcoin. 

So: if you hold your own keys, you probably don't need to worry about paper bitcoin.

[^1]: You agree that all forms of the same Digital Asset that are held and made available across multiple blockchain protocols may be treated as fungible and the equivalent of each other, without regard to (a) whether any form of such Digital Asset is wrapped or (b) the blockchain protocol on which any form of such Digital Asset is stored. [Coinbase](https://www.coinbase.com/legal/user_agreement/united_states)

[^2]: In connection with holding your Digital Assets, we may transfer such Digital Assets off of the primary blockchain protocol and hold such Digital Assets on shared blockchain addresses we control or on alternative blockchain protocols in forms compatible with such protocols. You agree that all forms of the same Digital Asset may be treated as fungible and the equivalent of each other, including those that are held and made available across multiple blockchain protocols and without regard to (a) whether any form of such Digital Asset is wrapped or (b) the blockchain protocol on which any form of such Digital Asset is stored. [Kraken](http://kraken.com/legal/global-terms)

*I've been reading Cryptoeconomics again, and this is an attempt to work through some of the ideas in the chapter called ["Thin Air Fallacy"](https://github.com/libbitcoin/libbitcoin-system/wiki/Thin-Air-Fallacy) which I am copying below.*

---

# Cryptoeconomics: [Thin Air Fallacy](https://github.com/libbitcoin/libbitcoin-system/wiki/Thin-Air-Fallacy)

There is a theory that [fractional reserve banking](https://en.wikipedia.org/wiki/Fractional-reserve_banking) inherently gives banks the ability to create money at no material cost. The theory does not depend on the [state](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#state) privilege of [seigniorage](https://en.wikipedia.org/wiki/Seigniorage). It is considered a consequence of the accounting practices of [free banking](https://en.wikipedia.org/wiki/Free_banking). This is sometimes referred to as creating money _ex nihilo_ or "[out of thin air](https://en.wikipedia.org/wiki/Fractional-reserve_banking#Criticisms_of_textbook_descriptions_of_the_monetary_system)".

> Banks do not, as too many textbooks still suggest, take deposits of existing money from savers and lend it out to borrowers: they create credit and money ex nihilo – extending a loan to the borrower and simultaneously crediting the borrower’s money account."
> 
> _Lord Turner, Chairman of the UK Financial Services Authority until its abolition in March 2013._ _Stockholm School of Economics Conference on: “Towards a Sustainable Financial System"._ _12 September 2013_

Adherents describe two competing views on money creation. The traditional understanding is naive in relation to their more practical view, as implied by Lord Turner. The theory states that banking inherently creates not only credit, but also money.

#### Naive View

[](https://github.com/libbitcoin/libbitcoin-system/wiki/Thin-Air-Fallacy#naive-view)

Money is created by [miners](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#miner) at a material cost, potentially sold to [people](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#person), and eventually [lent](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#lend) to people. This theory holds that the lender is lending only money he [owns](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#owner). As such the lender is operating at [full reserve](https://github.com/libbitcoin/libbitcoin-system/wiki/Full-Reserve-Fallacy) and cannot engage in the practice of fractional reserve, which is considered fraudulent. As an honest lender he is only able to issue claims ([representative money](https://en.wikipedia.org/wiki/Representative_money)) against money in his possession, preventing [credit expansion](https://github.com/libbitcoin/libbitcoin-system/wiki/Credit-Expansion-Fallacy) and therefore persistent [price inflation](https://en.wikipedia.org/wiki/Inflation).

#### Practical View

[](https://github.com/libbitcoin/libbitcoin-system/wiki/Thin-Air-Fallacy#practical-view)

Money substitutes are created by banks, at no material cost, as a consequence of fractional reserve lending. The supply of these substitutes expands with every loan, contracting only as loans are [settled](https://en.wikipedia.org/wiki/Clearing_\(finance\)). Given the implied lack of constraint on credit expansion, overall debt grows without bound, creating persistent price inflation.

In a free market people can perform the same operations as banks, without necessarily calling themselves banks. Therefore the distinction between these two possibilities must be based on obscuration of the supposed fraud. The theory holds that this obscuration is accomplished using an accounting trick that is not widely understood. So let us investigate the difference. Any money will suffice in this investigation of the [money substitutes](https://wiki.mises.org/wiki/Money_substitutes) created in either case, including Gold, Bitcoin or [monopoly money](https://github.com/libbitcoin/libbitcoin-system/wiki/Money-Taxonomy).

In the naive view, the potential lender has saved both the liquidity required for personal consumption ([hoard](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#lend)) and the amount intended for earning [interest](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#interest) ([investment](https://github.com/libbitcoin/libbitcoin-system/wiki/Glossary#investment)). All lending in this scenario originates from savings, such as gold accumulated from [panning](https://en.m.wikipedia.org/wiki/Gold_panning). Savings includes the sum of the hoard (money) and the amount that credit exceeds debt: `savings = money + (credit - debt)`. Money is gold and credits are money substitutes:

||Savings|Money|Credit|Debt|
|---|---|---|---|---|
|Person|100oz|100oz|||

In this view of personal lending, Person hands over 81oz of gold to Borrower. Borrower accepts an obligation to repay Person with interest at [loan maturity](https://en.wikipedia.org/wiki/Maturity_\(finance\)). To simplify the accounting we will assume zero interest and no accounting (i.e. discounting) for repayment risk:

||Savings|Money|Credit|Debt|
|---|---|---|---|---|
|Person|100oz|19oz|81oz||
|Borrower||81oz||81oz|

Person has actually lent to his own enterprise (e.g. lending business) a fraction of his savings, which is accounted for below. Let us assume that Person hoards 10% of his savings for the liquidity required for near-term consumption and his Business hoards 10% for the same reason:

||Savings|Money|Credit|Debt|
|---|---|---|---|---|
|Person|100oz|10oz|90oz||
|Business||9oz|81oz|90oz|
|Borrower||81oz||81oz|

Person's business is operating with 10% reserve, as 90% of his deposited money is at risk of default. Projecting this into the naive view of banking requires only renaming "Person" to "Depositor" and "Business" to "Bank". There is no need to assume that these are distinct individuals:

||Savings|Money|Credit|Debt|
|---|---|---|---|---|
|Depositor|100oz|10oz|90oz||
|Bank||9oz|81oz|90oz|
|Borrower||81oz||81oz|

By properly accounting for Person having money at risk (i.e. a depositor) we can see that all lending is fractionally reserved. There are two loans in this scenario reserved at 10%, resulting in monetary substitutes (credit) of 171% of money. Given the assumption of uniform [time preference](https://github.com/libbitcoin/libbitcoin-system/wiki/Time-Preference-Fallacy), Borrower will lend 90% of his savings, as will all subsequent borrowers. Assuming a minimum practical loan of 1oz, after 43 loans credit expansion terminates at 8.903 times the amount of money.

Where `r` is the uniform level of individual reserve and `m` is the amount of money, the total amount of credit `c` for any number of loans `n` is given by the following [partial sum](https://www.wolframalpha.com/input/?i=sum+of+m+*+\(1-r\)%5En+as+n+goes+from+1+to+infinity):

```
c = ∑(n=1..n)[m * (1 - r)^n] =
(m * (r - 1) ((1 - r)^n - 1))/r =
(100oz * (10% - 1) ((1 - 10%)^43 - 1))/10% = 890.3oz
```

The [reserve ratio](https://en.wikipedia.org/wiki/Reserve_requirement) `rr` is given by the ratio of money to credit:

```
rr = m/c = 100oz/890.3oz = ~11.23%
```

The [money multiplier](https://en.wikipedia.org/wiki/Money_multiplier) is given by the inverse of the reserve ratio:

```
1/rr = 1/(100oz/890.3oz) = 8.903
```

It is only because a single dollar is considered the smallest lendable unit that the series is limited to 43 iterations. A continuous function produces a money multiplier of 9 at 10% hoarding.

Iteration yields the following table:

|Loan|Hoarded|Loaned|Credit|
|---|---|---|---|
|1|10.00|90.00|90.00|
|2|19.00|81.00|171.00|
|3|27.10|72.90|243.90|
|4|34.39|65.61|309.51|
|5|40.95|59.05|368.56|
|6|46.86|53.14|421.70|
|7|52.17|47.83|469.53|
|8|56.95|43.05|512.58|
|9|61.26|38.74|551.32|
|10|65.13|34.87|586.19|
|11|68.62|31.38|617.57|
|12|71.76|28.24|645.81|
|13|74.58|25.42|671.23|
|14|77.12|22.88|694.11|
|15|79.41|20.59|714.70|
|16|81.47|18.53|733.23|
|17|83.32|16.68|749.91|
|18|84.99|15.01|764.91|
|19|86.49|13.51|778.42|
|20|87.84|12.16|790.58|
|21|89.06|10.94|801.52|
|22|90.15|9.85|811.37|
|23|91.14|8.86|820.23|
|24|92.02|7.98|828.21|
|25|92.82|7.18|835.39|
|26|93.54|6.46|841.85|
|27|94.19|5.81|847.67|
|28|94.77|5.23|852.90|
|29|95.29|4.71|857.61|
|30|95.76|4.24|861.85|
|31|96.18|3.82|865.66|
|32|96.57|3.43|869.10|
|33|96.91|3.09|872.19|
|34|97.22|2.78|874.97|
|35|97.50|2.50|877.47|
|36|97.75|2.25|879.72|
|37|97.97|2.03|881.75|
|38|98.18|1.82|883.58|
|39|98.36|1.64|885.22|
|40|98.52|1.48|886.70|
|41|98.67|1.33|888.03|
|42|98.80|1.20|889.22|
|43|98.92|1.08|890.30|

Notice that, at full expansion, for any person to spend from his hoard while maintaining his time preference, a loan must be settled to offset the spending. The settlement process moves the money from the former borrower to its lender, and cancels the note. The person in receipt of the spent money must lend it in order to satisfy his time preference, and so on.

No further expansion is possible without an increase in the amount of money or an overall reduction in time preference. An increase in money increases the absolute amount of credit and a reduction in time preference increases the proportion of credit to money. Given that money and credit evolve together, there is never any actual increase in money substitutes apart from these changes.

In the typical practice of bank accounting, Bank does not hand over the money. Instead it creates account entries in a process referred to as "credit creation". It creates offsetting [ledger](https://en.wikipedia.org/wiki/Ledger) entries for Depositor's proceeds and loan ("credit" and "debt"), and offsetting [balance sheet](https://en.wikipedia.org/wiki/Balance_sheet) entries for itself ("asset" and "liability"). At the time of loan issuance, the accounts are as follows:

||Savings|Money|Credit|Debt|Asset|Liability|
|---|---|---|---|---|---|---|
|Depositor|100oz|10oz|90oz||100oz||
|Bank||90oz|81oz|171oz|171oz|171oz|
|Borrower|||81oz|81oz|81oz|81oz|

This is where [explanations of the theory](https://www.sciencedirect.com/science/article/pii/S1057521915001477) tend to terminate. The offsetting accounts of both Bank and Borrower balance, but Borrower has 81oz of gold to spend, and Bank has not had to turn over any gold to Borrower. There is still only 100oz of money, but Borrower has 81oz of money substitute and Bank has 81oz more in assets. The theory proclaims that Bank has thus created not only credit, but also _money_. Notice that everything still balances, and all accounts can be settled, seemingly validating the theory as espoused by Lord Turner, that: "...they create credit and money ex nihilo – extending a loan to the borrower and simultaneously crediting the borrower’s money account."

This however demonstrates no actual spending of either the loan credit or the bank asset. Let us take this a bit further by assuming Borrower clears his account, and therefore the corresponding Bank asset and liability entries.

||Savings|Money|Credit|Debt|Asset|Liability|
|---|---|---|---|---|---|---|
|Depositor|100oz|10oz|90oz||100oz||
|Bank||9oz|81oz|90oz|90oz|90oz|
|Borrower||81oz||81oz|81oz|81oz|

Notice that the this is identical to the outcome of the naive view. **There is no distinction between these supposedly-competing views on money creation,** invalidating the theory. This resolves the [centuries-old debate](https://en.wikipedia.org/wiki/Credit_theory_of_money#Scholarship), apparently begun between [Plato](https://en.wikipedia.org/wiki/Plato) and [Aristotle](https://en.wikipedia.org/wiki/Aristotle), regarding whether money is based on mining or credit. The theories are identical, as money and credit are a [duality](https://en.wiktionary.org/wiki/duality).

> According to Joseph Schumpeter, the first known advocate of a credit theory of money was Plato. Schumpeter describes metallism as the other of "two fundamental theories of money", saying the first known advocate of metallism was Aristotle.

Adherents of the two theories are merely [talking past each other](https://en.m.wikipedia.org/wiki/Talking_past_each_other). Bitcoin, as fiat (i.e. [non-use-value](https://en.m.wikipedia.org/wiki/Use_value) money) [without state support](https://github.com/libbitcoin/libbitcoin-system/wiki/Value-Proposition), has finally made observable both the logical errors of [metallism](https://en.m.wikipedia.org/wiki/Metallism), which [attempted to show](https://github.com/libbitcoin/libbitcoin-system/wiki/Regression-Fallacy) the necessity of use value to money, and [chartalism](https://en.m.wikipedia.org/wiki/Chartalism), which [attempted to show](https://github.com/libbitcoin/libbitcoin-system/wiki/Debt-Loop-Fallacy) the necessity of state support to fiat.

Recall that each loan is reserved at 10%, so Bank can lend up 8.903 times the amount of money on reserve, or 890.3oz of money substitute against 100oz money reserved. If Bank reserves each loan at 0%, credit expansion would be infinite. However this implies zero time preference, or the idea that time has no value, implying that all money is lent indefinitely. In the case of Bank, 0% reserve implies no liquidity to satisfy any withdrawal (i.e. immediate failure). Yet given zero time preference there could never be any withdrawals, making the scenario irrelevant. Credit expansion is necessarily finite.

So let us revisit the scenario where Bank creates credit at negative reserve (i.e. out of thin air), this time considering spending. For example, on deposits of 0oz Bank intends to issue a loan of 1000oz. Instead of relying on reserved money to eventually settle the loan, Bank "creates money" on its balance sheet. Bank then increases Borrower's credit and debt accounts, representing the borrowed money and the obligation to repay respectively:

||Savings|Money|Credit|Debt|Asset|Liability|
|---|---|---|---|---|---|---|
|Bank|||1000oz|1000oz|1000oz|1000oz|
|Borrower|||1000oz|1000oz|1000oz|1000oz|

When Borrower trades 1oz (from his credit account) for a car, his credit account is decreased by 1oz and Merchant's is increased by 1oz. Note that Borrower now owes Bank 1oz, as anticipated by the loan agreement.

||Savings|Money|Credit|Debt|Asset|Liability|
|---|---|---|---|---|---|---|
|Bank|||1000oz|1000oz|1000oz|1000oz|
|Borrower|-1oz||999oz|1000oz|999oz|1000oz|
|Merchant|1oz||1oz||1oz||

All looks good until Merchant attempts to withdraw from his account. At that point Bank has defaulted and Merchant is unpaid. If Merchant's account is with another bank, the payment fails as soon as the two banks attempt to settle accounts. With a hypothetical negative reserve, the accounts balance as follows, indicating [Bank's demise](https://en.wikipedia.org/wiki/Bank_failure) (negative money):

||Savings|Money|Credit|Debt|Asset|Liability|
|---|---|---|---|---|---|---|
|Bank|-1oz|-1oz|1000oz|999oz|999oz|999oz|
|Borrower|||999oz|1000oz|999oz|1000oz|
|Merchant|1oz|1oz|||1oz||

The money [must actually be moved](https://www.brinks.com/en/public/brinks/logistics) from the control of Bank to Merchant or Merchant's bank, which is not possible. A simpler example is the failure of any attempt by Borrower to [withdraw](https://en.wikipedia.org/wiki/Automated_teller_machine) from his account. Bank may create as much money substitute as it wants, but negative reserve is just an [empty promise](https://en.wiktionary.org/wiki/empty_promise). In this example Bank has created 1000oz of promises that it cannot keep.

The failure to recognize these principles likely results from failure to consider the [settlement process](https://www.youtube.com/watch?v=IzE038REw2k). This likely stems from the failure to recognize the inherent _duality of money and credit_, as the former must always exist to settle the claims implied by the latter. This likely stems from the habit of referring to money (e.g. gold) in the same terms as money substitutes (e.g. credits for gold).

The offsetting asset and liability entries served only to account for loans issued and outstanding, which are the basis of Bank's balance sheet. Bank similarly did not create the offsetting credit and debt entries to obscure fraudulent money creation. Bank created these accounts for two reasons:

- Preclude physical transfer just to redeposit the money into Bank.
- Encourage redeposit into Bank as opposed to a competitor (or Borrower hoard).

When Bank has insufficient reserve to satisfy withdrawals, either due to loans in default or a [bank run](https://en.wikipedia.org/wiki/Bank_run), it has only two options, default or borrow. To prevent the former, [central banking](https://en.wikipedia.org/wiki/Central_bank) exists to provide the latter. This is the meaning of the term "[lender of last resort](https://en.wikipedia.org/wiki/Lender_of_last_resort)". [State Banking Principle](https://github.com/libbitcoin/libbitcoin-system/wiki/State-Banking-Principle) provides a detailed explanation of this actual source of [monetary inflation](https://en.wikipedia.org/wiki/Monetary_inflation).

In summary, it has been shown that:

- Banks have no ability to create money.
- Fractional reserve is inherent in lending.
- The fraction of reserve is an expression of time preference.
- Zero reserve eliminates any chance of being able to settle accounts.
- No distinction exists between naive and practical theories of money creation.
