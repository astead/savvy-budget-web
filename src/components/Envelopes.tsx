import React, { useEffect, useState } from 'react';
import { Header } from './header.tsx';
import { baseUrl, channels } from '../shared/constants.js'
import { MonthSelector } from '../helpers/MonthSelector.tsx';
import * as dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import BudgetBalanceModal from './BudgetBalanceModal.tsx';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import InputText from '../helpers/InputText.tsx';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

/*
  TODO:
  - Don't really like how this is loading everything sequentially
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

  function formatCurrency(currencyNumber:number) {
    return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
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

  const [, setLoadingStates] = useState({
    loadedPrevBudget: false,
    loadedCurrBudget: false,
    loadedPrevActual: false,
    loadedCurrBalance: false,
    loadedCurrActual: false,
    loadedMonthlyAvg: false,
  });

  const [curTotalBudgetIncome, setCurTotalBudgetIncome] = useState(0);
  const [curTotalBudgetSpending, setCurTotalBudgetSpending] = useState(0);
  const [curTotalActualUndefined, setCurTotalActualUndefined] = useState(0);
  
  const [transferEnvList, setTransferEnvList] = useState<any[]>([]);
  //const [transferEnvListLoaded, setTransferEnvListLoaded] = useState(false);

  const setLoadingState = (key, value) => {
    setLoadingStates((prevState) => ({ ...prevState, [key]: value }));
  };

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
      return match ? { ...item, prevBudget: match.txAmt } : item;
    });
    
    setLoadingState('loadedCurrBudget', true);
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
      return match ? { ...item, prevActual: match.totalAmt } : item;
    });
   
    setLoadingState('loadedPrevBudget', true); 
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
      return match ? { ...item, currBalance: match.balance } : item;
    });
    
    setLoadingState('loadedPrevActual', true); 
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
      return match ? { ...item, currBudget: match.txAmt } : item;
    });

    const haveValues = rows.some((row) => row.txAmt !== 0);

    if (haveValues) {
      setHaveCurrBudget(true);
    } else {
      setHaveCurrBudget(false);
    }
    
    setLoadingState('loadedCurrBalance', true);
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
      return match ? { ...item, currActual: match.totalAmt ?? 0 } : item;
    });

    // Sum the totalAmt values from rows where no match is found in budgetData
    rows.forEach((row) => {
      const match = budgetData.find((item) => item.envID === row.envelopeID);
      if (!match) {
        myTotalCurr += row.totalAmt ?? 0;
      }
    });
  
    setCurTotalActualUndefined(myTotalCurr);
    setLoadingState('loadedCurrActual', true);
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
    
    if (numMonths > 0) {
      const updatedData = currentData.map((item) => {
        const match = rows.find((d) => d.envelopeID === item.envID);
        const ttmAvg = match ? (match.totalAmt / numMonths) : 0;
        return { ...item, monthlyAvg: ttmAvg };
      });

      setLoadingState('loadedMonthlyAvg', true);
      return updatedData; 
    } else {
      setLoadingState('loadedMonthlyAvg', true);
      return currentData;
    }
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

  const handleBalanceChangeTransfer = async () => {
    setBudgetData(await load_CurrBalance(budgetData));
  }

  const handleUpdateBudget = async ({index, id, date, value}) => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.UPDATE_BUDGET, 
      { newEnvelopeID: id, newtxDate: date, newtxAmt: value }, config);
    handleBudgetItemChange(index, value);
  }

  const handleBudgetItemChange = (index, value) => {
    const oldValue = budgetData[index].currBudget;
    budgetData[index].currBudget = parseFloat(value);
    budgetData[index].currBalance += value - oldValue;
    get_totals();
  }

  const set_color = (target, actual) => {
    if (actual > target) {
      return '#dd8888'
    } else if (actual <= target) {
      return 'none'
    }
  }

  const get_totals = () => {
    let myTotalBudgetIncome = 0;
    let myTotalBudgetSpending = 0;

    for (const [, n] of budgetData.entries()) {
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
    console.log("loadData");
    try {
      let combinedData = budgetData;
      combinedData = await load_PrevBudget(combinedData);
      combinedData = await load_PrevActual(combinedData);
      combinedData = await load_CurrBalance(combinedData);
      combinedData = await load_CurrBudget(combinedData);
      combinedData = await load_CurrActual(combinedData);
      combinedData = await load_MonthlyAvg(combinedData);
      setBudgetData(combinedData);

      setLoadingStates({
        loadedCurrBudget: true,
        loadedPrevBudget: true,
        loadedPrevActual: true,
        loadedCurrBalance: true,
        loadedCurrActual: true,
        loadedMonthlyAvg: true,
      });
      setLoaded(true);

      get_totals();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    console.log("useEffect [curMonth]");
    if (gotMonthData) {
      setLoadedEnvelopes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth]);  

  useEffect(() => {
    console.log("useEffect [loadedEnvelopes, budgetData.length]");
    console.log("loadedEnvelopes: ", loadedEnvelopes);
    console.log("budgetData?.length: ", budgetData?.length);
    // Once we have the main table data, we can go get
    // the details and fill it in.
    if (loadedEnvelopes && budgetData?.length > 0) {      
        loadData();
    } else if (!loadedEnvelopes) {
      // We must be re-setting due to a month selection change.
      // Lets wipe this out and force it to start over.
      setLoaded(false);
      setLoadingStates({
        loadedCurrBudget: false,
        loadedPrevBudget: false,
        loadedPrevActual: false,
        loadedCurrBalance: false,
        loadedCurrActual: false,
        loadedMonthlyAvg: false,
      });
      setBudgetData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedEnvelopes, budgetData.length]);

  useEffect(() => {
    console.log("useEffect []");
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
                    <tr key={item.envID} className="TR">
                      <td className="Table TC Left">{item.envelope}</td>
                      <td className="Table TC Right">{formatCurrency(item.prevBudget)}</td>
                      <td className="Table TC Right">
                        <Link to={
                          "/Transactions" +
                          "/-1/" + item.envID + 
                          "/1/" + new Date(year, month-1).getFullYear() + 
                          "/" + new Date(year, month-1).getMonth()}>
                          {formatCurrency(item.prevActual)}
                        </Link>
                      </td>
                      <td className="Table BTC Right TCInput">
                        <BudgetBalanceModal 
                          balanceAmt={item.currBalance}
                          category={item.category}
                          envelope={item.envelope}
                          envID={item.envID}
                          transferEnvList={transferEnvList}
                          callback={handleBalanceChangeTransfer}
                        />
                      </td>
                      <td className="Table TC Right">
                        <InputText
                          in_ID={item.envID}
                          in_value={item.currBudget}
                          callback={(id, value) => {
                            handleUpdateBudget({index, id, date: curMonth, value});
                          }}
                          className={"Curr"}
                          style={{backgroundColor: set_color(item.currBudget, -1*item.monthlyAvg) }}
                        />
                      </td>
                      <td className="Table TC Right"
                        style={{backgroundColor: set_color(item.currBudget, -1*item.currActual) }}>
                        <Link to={"/Transactions/-1/" + item.envID + "/1/" + year + "/" + month}>
                          {formatCurrency(item.currActual)}
                        </Link>
                      </td>
                      <td className="Table TC Right">
                        <Link to={"/Charts/env" + item.envID}>
                          {formatCurrency(item.monthlyAvg)}
                        </Link>
                      </td>
                    </tr>
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