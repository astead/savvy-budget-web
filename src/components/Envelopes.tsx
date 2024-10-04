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
  TODO: Set the width of this page so it is the same for each month.
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
  const [loadedEnvelopes, setLoadedEnvelopes] = useState(false);
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
    const response = await axios.post(baseUrl + channels.GET_PREV_ACTUAL, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);

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
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, currBudget: match.txAmt } : { envID: item.envID };
    });

    const haveValues = rows.some((row) => row.txAmt !== 0);

    if (haveValues) {
      setHaveCurrBudget(true);
    } else {
      setHaveCurrBudget(false);
    }
    
    return updatedData;
  };

  const load_CurrActual = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_ACTUAL, { find_date: dayjs(new Date(year, month+1)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let rows = response.data;  
    let myTotalCurr = 0;    
  
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, currActual: match.totalAmt ?? 0 } : { envID: item.envID };
    });

    // Sum the totalAmt values from rows where no match is found in budgetData
    rows.forEach((row) => {
      const match = budgetData.find((item) => item.envID === row.envelopeID);
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
    const prev_budget_values = budgetData.map((item) => {
      return {envID: item.envID, value: item.prevBudget};
    });

    if (!config) return;
    await axios.post(baseUrl + channels.COPY_BUDGET, 
      { newtxDate: dayjs(new Date(year, month)).format('YYYY-MM-DD'),
        budget_values: prev_budget_values }, config
    );
    
    let combinedData = budgetData;
    combinedData = await load_CurrBudget(combinedData);
    combinedData = await load_CurrBalance(combinedData);
    setBudgetData(combinedData);
  }

  const handleBalanceTransfer = async ({ updatedRow, transferAmt, toID }) => {
    let updatedData = budgetData.map((row) => {
      if (row.envID === updatedRow.envID) {
        return updatedRow;
      } else if (row.envID === toID) {
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
  
  const load_initialEnvelopes = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_BUDGET_ENV, null, config);
  
    // Receive the data
    let data = response.data;
    if (data?.length) {
      const defaultValues = {
        prevBudget: 0,
        prevActual: 0,
        currBalance: 0,
        currBudget: 0,
        monthlyAvg: 0,
        currActual: 0,
      };

      const enrichedData = data.map((item) => ({ ...item, ...defaultValues })) as BudgetNodeData[];
      const sortedData = enrichedData.sort(compare);
      setLoadedEnvelopes(true);
      setBudgetData(sortedData);
    }
  }

  const loadData = async () => {
    try {
      // Fetch all data in parallel
      const [currBudgetData, prevBudgetData, currBalanceData, currActualData, monthlyAvgData, prevActualData] = 
      await Promise.all([
        load_CurrBudget(budgetData),
        load_PrevBudget(budgetData),
        load_CurrBalance(budgetData),
        load_CurrActual(budgetData),
        load_MonthlyAvg(budgetData),
        load_PrevActual(budgetData),
      ]);

      // Combine the results
      const combinedData = budgetData.map((item, index) => ({
        ...item,
        ...currBudgetData[index],
        ...prevBudgetData[index],
        ...currBalanceData[index],
        ...currActualData[index],
        ...monthlyAvgData[index],
        ...prevActualData[index],
      }));

      // Update the state once with the combined data
      setBudgetData(combinedData);

      setLoaded(true);

      get_totals(combinedData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    if (gotMonthData) {
      setLoadedEnvelopes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth]);  

  useEffect(() => {
    // Once we have the main table data, we can go get
    // the details and fill it in.
    if (loadedEnvelopes && budgetData?.length > 0) {      
        loadData();
    } else if (!loadedEnvelopes) {
      // We must be re-setting due to a month selection change.
      // Lets wipe this out and force it to start over.
      setLoaded(false);
      setBudgetData([]);
      
      // TODO: I wonder if there is a race condition here
      // as above we are setting budgetData and inside
      // load_initialEnvelopes we are also going to set
      // budgetData. I wonder if we should take the same
      // approach as with getting each column of data and
      // pass in our starting data set?
      load_initialEnvelopes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedEnvelopes, budgetData.length]);

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
    load_initialEnvelopes();

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
                    <th className="Table THR THRC Small">
                      <div className="PrevTHRC">
                        <div className="PrevHRCLabel">
                          { dayjs(new Date(year, month)).subtract(1,'month').format("MMM 'YY") + '\nBudget' }
                        </div>
                        {!haveCurrBudget &&
                          <div
                            onClick={() => {
                              forward_copy_budget();
                            }}
                            className="right-button">
                            <FontAwesomeIcon icon={faChevronRight} />
                          </div>
                        }
                      </div>
                    </th>
                    <th className="Table THR THRC Small">
                      { dayjs(new Date(year, month)).subtract(1,'month').format("MMM 'YY") + '\nActual' }
                    </th>
                    <th className="Table THR THRC Small">{ 'Curr\nBalance' }</th>
                    <th className="Table THR THRC Small">{ dayjs(new Date(year, month)).format("MMM 'YY") + '\nBudget' }</th>
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
        {!loaded &&
          <div>
            Data is loading...
          </div>
        }
      </div>
    </div>
  );
}