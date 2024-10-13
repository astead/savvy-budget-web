// homePage.js

import React from 'react';
import { Header } from './header.tsx';

export const HomePage: React.FC = () => {
  const year = new Date().getFullYear();
  const month = new Date().getMonth();

    return (
      <div className="App">
        <header className="App-header">
          <Header currTab="Home"/>
        </header>
        <div className="main-page-body-text">
          <b>Welcome to Savvy Budget.</b><br />
          <b>History</b><br />
          Savvy Budget was initially created in 2002 as a way to track my personal budget.
          I set it up so it would require uploading downloaded bank transaction exports. 
          In 2008 I made some modifications so others could create accounts and use the site.
          In 2010 I spend a considerable amount of time virtually re-creating the site to make it simpler and 
          more secure. Eventually I abandoned it and just moved to Mint because I loved having it automatically pull transactions.  
          When Mint went away, I decided to resurrect it in early 2024.  I again re-created the whole thing using more up to date coding practices.
          I also implemented bank account linking using PLAID because I couldn't go back to downloading transactions and uploading them. 
          At first I set it up to all run locally with a file based database.  Later in 2024 I decided to open it up to others. 
          <br/><br/>
          <b>What is it?</b><br />
          Savvy Budget is kind of like a combination of envelope budgeting and double entry accounting.
          The idea of envelope budgeting is that you have envelopes for
          each spending category such as the electric bill or groceries.
          You then set money aside from your paycheck into the appropriate envelopes
          so that you ensure you have enough money to pay them all.
          Double entry accounting means that you have a credit and a debit for each transaction.
          <br/><br/>
          <b>Setting a budget philosophy</b><br />
          Savvy Budget loosely applies double entry accounting and the envelope system when you setup your budget.
          When setting aside money in each envelope it should come from somewhere.
          The goal in setting a budget is your expenses should equal your income and they should add up to 0. 
          If you are putting $1000 in your grocery envelope, you should take $1000 out of your income envelope.
          To record this you would enter a positive $1000 in your grocery envelope, and a negative $1000 in your income envelope.
          Then as your income shows up, it shows up as positive values and starts paying off the $1000 you set aside for groceries.
          <br/>
          You should try and always make your budgets sum up to 0. If you have extra income that you don't know which envelope to put it in,
          you can create a "saving" envelope, or setup an envelope for a specific goal, such as "New car" or "Kid's college".<br/>
          If your budget doesn't sum up to 0, you will end up with un-tracked income or expenses. For instance if I put $1,000,000 in my
          "snowboarding vacation" envelope, but don't account for it in the income envelope(s) my budget will be negative, but that
          negative won't be reflected in any envelope. To properly account for that money set aside in the envelope I need to take it out 
          of another envelope.<br/>
          Envelope balances are tracked, and if one ends up with a surplus, you can move that surplus to another envelope. In the same
          way if an envelope runs a negative balance it means you are borrowing from yourself (essentially other envelopes). <br/>
          Adding up all the envelope balances should tell you your available balances.
          If they are negative it means you've borrowed from yourself more than your income.
          If they are positive it means you've made more than you've spent.
          <br/><br/>
          <b>How much does it cost?</b><br />
          The basic Savvy Budget is free to use. If it doesn't cost me extra money, then it won't cost you money.<br/>
          <li>
            <b>Free Downloaded version:</b> You can download the version that runs on your local computer for free and keep it forever.
            It will setup a local unencryted database file (sqlite format) that you are completely responsible for. It will not 
            talk to any other computer on the internet. To add new transactions you can enter them manually or upload your bank 
            transaction exports. I also have all that source code available on github.
          </li>
          <li>
            <b>Free Online version:</b> As I mentioned, if it doesn't cost me extra money, I won't charge you.
            Some of my costs are fairly fixes, but low. For instance web hosting and (for now) cloud database hosting. With this version
            the data is stored in an encrypted cloud based database, but to add new transactions you can enter them manually or upload your bank 
            transaction exports. If I start getting charged more for having a cloud based database, then I might need to implement a charge 
            to cover that. If that happens, you could switch to the downloaded version and store the data on your system or setup your own
            free cloud database.
          </li>
          <li>
            <b>Paid Online version:</b> This adds the bank account linking so your transactions are pulled from your bank without having to 
            mess with uploading bank transaction exports.
          </li>
          <li>
            <b>Mobile verions:</b> I am planning to add Android and iOS versions. I haven't decided what that cost structure will look like.
            I am hoping to set those up as free, and have limited functionality on them, for instance only checking current envelope
            balances.
          </li>
          <br /><br />
          <b>Getting Started</b><br />
          Here is the basic process for getting started:<br />
          <ol>
            <li>Create an account</li>
            <li>Configure your envelopes
              <ul>
                <li>Go to the <a href="/Configure">configure page</a> to setup envelopes and categories.</li>
              </ul>
            </li>
            <li>
              Get transactions
              <ul>
                <li>
                  If using linked bank accounts: on the configure page, setup any linked bank accounts and 
                  update it to get transactions for the past 90 days.
                  You can also do a force update to get transactions for a specific date range.
                </li>
                <li>
                  If not using linked bank accounts: Go to your bank website and download your statement in CSV or OFX format. 
                  Then go to the <a href={"/Transactions/-3/0/"+year+"/"+month}>transaction page</a> and upload your OFX file.
                  This part could be buggy as banks may use different formats (especially with CSV).
                </li>
              </ul>
            </li>
            <li>
              Categorize transactions
              <ul>
                <li>
                  Go to the <a href={"/Transactions/-3/0/"+year+"/"+month}>transaction page</a> and assign the transactions into envelopes. 
                  You can also assign keywords as you go to avoid having to do this every time for transactions that match.
                  This will help you get a rough idea of your current spending habits.
                  TODO: when setting a keyword, go and set all matching transactions to the same immediately. 
                </li>
              </ul>
            </li>
            <li>
              Set your budget
              <ul>
                <li>On the <a href="Envelopes">envelopes page</a>, select the current month.</li>
                <li>Reset envelope balances to what you see as current spending for that month by clicking on the envelope balance cell and updating the balance.<br/>
                    You should only have to do this one time to ignore previous data. I debated how best to approach this,
                    but ultimately settled on this approach so you can see the previous income/spending habits but you start your balances
                    off with a clean start.
                </li>
                <li>Set your expected income for the month.</li>
                <li>Set your envelope amounts for the month, remember to make sure your spending equals your income.</li>
              </ul>
            </li>
            <li>
              Monitor and update
              <ul>
                <li>Check up on how you are doing and adjust as needed.</li>
              </ul>
            </li>
          </ol>
          <br />
          Happy Budgeting!
          <br/><br/>
          Please send any bugs, feature requests, comments, questions to: alan.stead@gmail.com<br/>
          Please put something like "SavvyBudget" in the subject.<br/>
          Depending on how many emails I get, I may shift this to a more formal process.
        </div>
    
        <br/><br/>
        <a href="https://www.flaticon.com/free-icons/budget" title="budget icons">Budget icons created by khulqi Rosyid - Flaticon</a>
      </div>
    );
};
