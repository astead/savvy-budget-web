import React, { useEffect, useState } from 'react';
import { Header } from './header.tsx';
import { baseUrl, channels } from '../shared/constants.js'
import { MonthSelector } from '../helpers/MonthSelector.tsx';
import * as dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { EnvelopeRow } from './EnvelopeRow.tsx';

/*
  TODO:
  - Set the width of this page so it is the same for each month.
  - BUG: Sometimes after about a second on the page all the values get reset to 0.
 */

export const Envelopes: React.FC = () => {
  const { config } = useAuthToken();
  
  /* Month Selector code -------------------------------------------*/
  const [year, setYear] = useState((new Date()).getFullYear());
  const [month, setMonth] = useState((new Date()).getMonth());
  const [curMonth, setCurMonth] = useState(dayjs(new Date(year, month)).format('YYYY-MM-DD'));
  const [myStartMonth, setMyStartMonth] = useState(new Date(year, month));
  const [myCurIndex, setMyCurIndex] = useState(0);
  const [gotMonthData, setGotMonthData] = useState(false);
  
  const monthSelectorCallback = ({ childStartMonth, childCurIndex, source }) => {
    
    // Need to adjust our month/year to reflect the change
    const child_start = new Date(childStartMonth);
    const child_month = child_start.getMonth();
    const child_year = child_start.getFullYear();
    let tmpDate = new Date(child_year, child_month + childCurIndex);

    localStorage.setItem('envelopes-month-data', JSON.stringify({ childStartMonth, childCurIndex }));
    setMyStartMonth(childStartMonth);
    setMyCurIndex(childCurIndex);
    setYear(tmpDate.getFullYear());
    setMonth(tmpDate.getMonth());
    setCurMonth(dayjs(tmpDate).format('YYYY-MM-DD'));
  };
  /* End Month Selector code ---------------------------------------*/
  
  interface BudgetNodeData {
    catID: number; 
    category: string;
    currBalance: number; 
    currBudget: number; 
    envID: number; 
    envelope: string;
    monthlyAvg: number; 
    prevActual: number;
    currActual: number; 
    prevBudget: number; 
  };

  function formatWholeCurrency(currencyNumber:number) {
    return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  };

  const compare = (a, b) => {
    if (a.category === 'Income' || b.category === 'Income') {
      if (a.category === 'Income' && b.category !== 'Income') {
        return -1;
      }
      if (a.category !== 'Income' && b.category === 'Income') {
        return 1;
      }
      if (a.envelope < b.envelope) {
        return -1;
      }
      if (a.envelope > b.envelope) {
        return 1;
      }
      return 0;
    } else {
      if (a.category < b.category) {
        return -1;
      }
      if (a.category > b.category) {
        return 1;
      }
      if (a.envelope < b.envelope) {
        return -1;
      }
      if (a.envelope > b.envelope) {
        return 1;
      }
      return 0;
    }
  };

  function monthDiff(d1, d2) {
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months-1;
  };
  
  const [budgetData, setBudgetData] = useState<BudgetNodeData[]>([]);
  const [loaded, setLoaded] = useState(false);  
  const [haveCurrBudget, setHaveCurrBudget] = useState(false);
  const [curTotalBudgetIncome, setCurTotalBudgetIncome] = useState(0);
  const [curTotalBudgetSpending, setCurTotalBudgetSpending] = useState(0);
  const [curTotalActualUndefined, setCurTotalActualUndefined] = useState(0);
  
  const [transferEnvList, setTransferEnvList] = useState<any[]>([]);
  //const [transferEnvListLoaded, setTransferEnvListLoaded] = useState(false);

  const load_envelope_list = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ENV_LIST, {onlyActive: 1}, config);

    setTransferEnvList(response.data.map((item) => {
      return { id: item.envID, text: item.category + " : " + item.envelope };
    }));
  };

  const load_PrevBudget = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_PREV_BUDGET, { find_date: dayjs(new Date(year, month-1)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let rows = response.data;
    
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? {  envID: item.envID, prevBudget: match.txAmt } : { envID: item.envID };
    });
    
    return updatedData; 
  };

  const load_PrevActual = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_PREV_ACTUAL, { 
      find_date: dayjs(new Date(year, month)).subtract(1, 'month').format('YYYY-MM-DD')
    }, config);

    // Receive the data
    let rows = response.data;
  
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, prevActual: match.totalAmt } : { envID: item.envID };
    });
   
    return updatedData;     
  };

  const load_CurrBalance = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CURR_BALANCE, null, config);
    
    // Receive the data
    let rows = response.data;
  
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.id === item.envID);
      return match ? { envID: item.envID, currBalance: match.balance } : { envID: item.envID };
    });
    
    return updatedData;
  };

  const load_CurrBudget = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_BUDGET, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let rows = response.data;
  
    // Go through the data and store it into our table array
    // Use null for missing budget items, to distinguish from 0 budget items
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, currBudget: match.txAmt } : { envID: item.envID, currBudget: null };
    });

    // Check if we have budget data for ALL envelopes
    // A complete budget means none of the items have null budget values
    const hasCompleteBudget = updatedData.every(item => item.currBudget !== null);
    
    setHaveCurrBudget(hasCompleteBudget);
    
    return updatedData;
  };

  const load_CurrActual = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_ACTUAL, {
      find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD')
    }, config);
    
    // Receive the data
    let rows = response.data;  
    let myTotalCurr = 0;    
  
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, currActual: match.totalAmt ?? 0 } : { envID: item.envID };
    });

    // Sum the totalAmt values from rows where no match is found in currentData.
    // Must use currentData (the passed-in snapshot), NOT the budgetData state,
    // because this function runs in parallel with the other loaders before
    // setBudgetData has ever been called — budgetData is still [] at this point.
    rows.forEach((row) => {
      const match = currentData.find((item) => item.envID === row.envelopeID);
      if (!match) {
        myTotalCurr += row.totalAmt ?? 0;
      }
    });
  
    setCurTotalActualUndefined(myTotalCurr);
    return updatedData;
  };

  const load_MonthlyAvg = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_MONTHLY_AVG, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let rows = response.data;  
    
    // Determine the earliest date from the data
    const firstDate = rows.reduce((earliest, item) => {
      const tmpDate = new Date(item.firstDate);
      return tmpDate < earliest ? tmpDate : earliest;
    }, new Date());
    
    const curDate = new Date(year, month);
    const numMonths = monthDiff(firstDate, curDate) + 1;
    
    
      const updatedData = currentData.map((item) => {
        if (numMonths > 0) {
          const match = rows.find((d) => d.envelopeID === item.envID);
          const ttmAvg = match ? (match.totalAmt / numMonths) : 0;
          return { envID: item.envID, monthlyAvg: ttmAvg };
        } else {
          return { envID: item.envID };
        }
      });

      return updatedData; 
  };

  const forward_copy_budget = async () => {
    // Filter to only items that are missing budgets (currBudget === null)
    // Items with currBudget === 0 already have a budget set to zero
    const missing_budget_values = budgetData
      .filter((item) => item.currBudget === null)
      .map((item) => ({
        envelopeID: item.envID,
        txAmt: item.prevBudget || 0
      }));

    if (missing_budget_values.length === 0) {
      console.log('No missing budget items to copy');
      return;
    }

    if (!config) return;
    
    // Process in batches to avoid timeout
    const chunkSize = 15; // Process 15 items at a time to stay under 10s limit
    const newtxDate = dayjs(new Date(year, month)).format('YYYY-MM-DD');
    
    try {
      for (let i = 0; i < missing_budget_values.length; i += chunkSize) {
        const chunk = missing_budget_values.slice(i, i + chunkSize);
        
        await axios.post(baseUrl + channels.COPY_BUDGET, 
          { newtxDate, budget_values: chunk }, config
        );
        
        // Optional: Show progress to user
        const progress = Math.min(100, Math.round(((i + chunk.length) / missing_budget_values.length) * 100));
        console.log(`Budget copy progress: ${progress}%`);
      }
      
      // Reload only the updated budget and balance data, preserving all other fields
      const updatedBudgets = await load_CurrBudget(budgetData);
      const updatedBalances = await load_CurrBalance(budgetData);
      
      // Merge the updates back into the existing budgetData
      const combinedData = budgetData.map((item, index) => ({
        ...item,
        currBudget: updatedBudgets[index].currBudget,
        currBalance: updatedBalances[index].currBalance,
      }));
      
      setBudgetData(combinedData);
      
      // Recalculate totals and check if all budgets are now complete
      get_totals(combinedData);
      
      // Check if we now have a complete budget (this updates haveCurrBudget state)
      // which will hide the copy button if all items are budgeted
      const budgetedCount = combinedData.filter(item => item.currBudget !== null).length;
      setHaveCurrBudget(budgetedCount === combinedData.length);
      
    } catch (error) {
      console.error('Error copying budget:', error);
    }
  }

  const handleBalanceTransfer = async ({ updatedRow, transferAmt, toID }) => {
    // Normalise toID to a number so comparisons against envID (a DB integer)
    // are reliable regardless of whether a string came through.
    const toIDNum = typeof toID === 'string' ? parseInt(toID, 10) : toID;

    // Guard: if the source and destination are the same envelope the server
    // makes no net change, so do not alter client state either.
    if (updatedRow.envID === toIDNum) return;

    let updatedData = budgetData.map((row) => {
      if (row.envID === updatedRow.envID) {
        return updatedRow;
      } else if (row.envID === toIDNum) {
        const newBalance = row.currBalance + parseFloat(transferAmt);
        return { ...row, currBalance: newBalance };
      } else {
        return row;
      }
    });

    setBudgetData(updatedData);
  }

  const handleRowUpdate = (updatedRow) => {
    const updatedData = budgetData.map((row) => (row.envID === updatedRow.envID ? updatedRow : row));
    setBudgetData(updatedData);
    get_totals(updatedData);
  };

  const get_totals = (currentData) => {
    let myTotalBudgetIncome = 0;
    let myTotalBudgetSpending = 0;

    for (const [, n] of currentData.entries()) {
      if (n.category === "Income") {
        myTotalBudgetIncome += n.currBudget;
      } else {
        myTotalBudgetSpending += n.currBudget;
      }
    };
    
    setCurTotalBudgetIncome(myTotalBudgetIncome);
    setCurTotalBudgetSpending(myTotalBudgetSpending);
  }

  useEffect(() => {
    if (gotMonthData) {
      // Create a single function to handle the loading sequence
      const loadEnvelopeData = async () => {
        try {
          // Clear existing data and set loading state
          setLoaded(false);
          
          // Step 1: Load the initial envelope structure
          if (!config) return;
          const response = await axios.post(baseUrl + channels.GET_BUDGET_ENV, null, config);
          
          // Initialize with default values
          if (response.data?.length) {
            const defaultValues = {
              prevBudget: 0,
              prevActual: 0,
              currBalance: 0,
              currBudget: 0,
              monthlyAvg: 0,
              currActual: 0,
            };

            const enrichedData = response.data.map((item) => ({ 
              ...item, 
              ...defaultValues 
            })) as BudgetNodeData[];
            const sortedData = enrichedData.sort(compare);
            
            // Step 2: Load all the detailed data in parallel
            const [
              currBudgetData, 
              prevBudgetData, 
              currBalanceData, 
              currActualData, 
              monthlyAvgData, 
              prevActualData
            ] = await Promise.all([
              load_CurrBudget(sortedData),
              load_PrevBudget(sortedData),
              load_CurrBalance(sortedData),
              load_CurrActual(sortedData),
              load_MonthlyAvg(sortedData),
              load_PrevActual(sortedData),
            ]);

            // Step 3: Combine all data in one update
            const combinedData = sortedData.map((item, index) => ({
              ...item,
              ...currBudgetData[index],
              ...prevBudgetData[index],
              ...currBalanceData[index],
              ...currActualData[index],
              ...monthlyAvgData[index],
              ...prevActualData[index],
            }));

            // Final state update - do this once with all data
            setBudgetData(combinedData);
            get_totals(combinedData);
            setLoaded(true);
          }
        } catch (error) {
          console.error('Error in envelope data loading sequence:', error);
        }
      };

      loadEnvelopeData();
    }
    // Only depend on month changes and initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth, gotMonthData, config]);

  useEffect(() => {

    // which month were we
    const my_monthData_str = localStorage.getItem('envelopes-month-data');
    if (my_monthData_str?.length) {
      const my_monthData = JSON.parse(my_monthData_str);
      if (my_monthData) {
        monthSelectorCallback(my_monthData);
      }
    }
    setGotMonthData(true);
    
    load_envelope_list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {<Header currTab="Envelopes"/>}
      </header>
      <div className="mainContent">
        {gotMonthData &&
          <MonthSelector numMonths="10" startMonth={myStartMonth} curIndex={myCurIndex} parentCallback={monthSelectorCallback} />
        }
        <br/>
        {loaded &&
          <div className="envelopeDataContainer">
            <div>
              <table className="Table" cellSpacing={0} cellPadding={0}>
              
                <thead>
                  <tr className="Table THR">
                    <th className="Table THR THRC">{' \nEnvelope'}</th>
                    <th className="Table THR THRC Small">{ dayjs(new Date(year, month)).subtract(1,'month').format("MMM 'YY") + '\nBudget' }</th>
                    <th className="Table THR THRC Small">
                      { dayjs(new Date(year, month)).subtract(1,'month').format("MMM 'YY") + '\nActual' }
                    </th>
                    <th className="Table THR THRC Small">{ 'Curr\nBalance' }</th>
                    <th className="Table THR THRC Small">
                      <div className="PrevTHRC">
                        {!haveCurrBudget &&
                          <div
                            onClick={() => {
                              forward_copy_budget();
                            }}
                            className="right-button">
                            <FontAwesomeIcon icon={faChevronRight} />
                          </div>
                        }
                        <div className="PrevHRCLabel">
                          { dayjs(new Date(year, month)).format("MMM 'YY") + '\nBudget' }
                        </div>
                      </div>
                    </th>
                    <th className="Table THR THRC Small">{ dayjs(new Date(year, month)).format("MMM 'YY")+ '\nActual' }</th>
                    <th className="Table THR THRC Small">{ 'TTM\nAvg' }</th>
                  </tr>
                </thead>
      
                <tbody>
                  {budgetData.map((item, index, myArray) => (
                    <React.Fragment key={index}>
                      { (index === 0 || (index > 0 && item.category !== myArray[index - 1].category)) && (
                        <tr key={'header-'+item.envID} className="Table TGHR">
                          <td colSpan={7} className="Table TGHR TC Left">{item.category}</td>
                        </tr>
                      )}
                      <EnvelopeRow
                        item={item}
                        year={year}
                        month={month}
                        curMonth={curMonth}
                        transferEnvList={transferEnvList}
                        onRowUpdate={handleRowUpdate}
                        onBalanceTransfer={handleBalanceTransfer}
                      />
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <br/><br/>
            </div>
            <div className="envelopeDataDiff">
              <div className="envelopeDataDiffFixed">
                <div className="envelopeDataDiffHeader">
                  <div>Budget Diff:</div>
                </div>
                
                <div className="envelopeDataDiffItem">
                  <div>Income:</div>
                  <div className="envelopeDataDiffItemCurr">
                    {formatWholeCurrency(curTotalBudgetIncome)}
                  </div>
                </div>
                
                <div className="envelopeDataDiffItem">
                  <div>Spending:</div>
                  <div className="envelopeDataDiffItemCurr">
                    {formatWholeCurrency(curTotalBudgetSpending)}
                  </div>
                </div>
                
                <div className="envelopeDataDiffItem">
                  <div>Diff:</div>
                  <div className={((curTotalBudgetIncome + curTotalBudgetSpending)<=0)?"Green envelopeDataDiffItemCurr":"DarkRed envelopeDataDiffItemCurr"}>
                    {formatWholeCurrency(curTotalBudgetIncome + curTotalBudgetSpending)}
                  </div>
                </div>

                <div>&nbsp;</div>
                
                <div className="envelopeDataDiffHeader">
                  <div>Actual:</div>
                </div>
                <div className="envelopeDataDiffItem">
                  <div>Missing:</div>
                  <div className="envelopeDataDiffItemCurr">
                    <Link to={"/Transactions/-1/-2/1/" + year + "/" + month}>
                      {formatWholeCurrency(curTotalActualUndefined)}
                    </Link>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  );
}