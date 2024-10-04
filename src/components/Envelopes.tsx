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

interface Envelope {
  envID: number;
  envelope: string;
  currBalance: number;
  isActive: boolean;
}

interface CategoryGroup {
  catID: number;
  cat: string;
  items: Envelope[];
}

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
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [haveCurrBudget, setHaveCurrBudget] = useState(false);
  const [loadedEnvelopes, setLoadedEnvelopes] = useState(false);
  const [loadedPrevBudget, setLoadedPrevBudget] = useState(false);
  const [loadedCurrBudget, setLoadedCurrBudget] = useState(false);
  const [loadedPrevActual, setLoadedPrevActual] = useState(false);
  const [loadedCurrBalance, setLoadedCurrBalance] = useState(false);
  const [loadedCurrActual, setLoadedCurrActual] = useState(false);
  const [loadedMonthlyAvg, setLoadedMonthlyAvg] = useState(false);

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

  const load_PrevBudget = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_PREV_BUDGET, { find_date: dayjs(new Date(year, month-1)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let data = response.data;
    const tmpData = [...budgetData] as BudgetNodeData[]; 
  
    for (let i=0; i < data.length; i++) {
      for (let j=0; j < tmpData.length; j++) {
        if (data[i].envelopeID === tmpData[j].envID) {
          tmpData[j] = Object.assign(tmpData[j], { prevBudget: data[i].txAmt });
        }
      }
    };
  
    setBudgetData(tmpData as BudgetNodeData[]); 
    setLoadedPrevBudget(true);     
  };

  const load_PrevActual = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_PREV_ACTUAL, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);

    // Receive the data
    let data = response.data;
    const tmpData = [...budgetData] as BudgetNodeData[]; 
  
    for (let i=0; i < data.length; i++) {
      for (let j=0; j < tmpData.length; j++) {
        if (data[i].envelopeID === tmpData[j].envID) {
          tmpData[j] = Object.assign(tmpData[j], { prevActual: data[i].totalAmt });
        }
      }
    };
  
    setBudgetData(tmpData as BudgetNodeData[]); 
    setLoadedPrevActual(true);     
  };

  const load_CurrBalance = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CURR_BALANCE, null, config);
    
    // Receive the data
    let data = response.data;
    const tmpData = [...budgetData] as BudgetNodeData[]; 
  
    for (let i=0; i < data.length; i++) {
      for (let j=0; j < tmpData.length; j++) {
        if (data[i].id === tmpData[j].envID) {
          tmpData[j] = Object.assign(tmpData[j], { currBalance: data[i].balance });
        }
      }
    };
    
    setBudgetData(tmpData as BudgetNodeData[]); 
    setLoadedCurrBalance(true);     
  };

  const load_CurrBudget = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_BUDGET, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let data = response.data;
    const tmpData = [...budgetData] as BudgetNodeData[]; 
    let haveValues = false;
  
    // Go through the data and store it into our table array
    for (let i=0; i < data.length; i++) {
      for (let j=0; j < tmpData.length; j++) {
        if (data[i].envelopeID === tmpData[j].envID) {
          tmpData[j] = Object.assign(tmpData[j], { currBudget: data[i].txAmt });
          if (data[i].txAmt !== 0) {
            haveValues = true;
          }
        }
      }
    };

    if (haveValues) {
      setHaveCurrBudget(true);
    } else {
      setHaveCurrBudget(false);
    }
    
    setBudgetData(tmpData as BudgetNodeData[]); 
    setLoadedCurrBudget(true);
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
    
    load_CurrBudget();
    load_CurrBalance();
  }

  const handleBalanceChangeTransfer = () => {
    load_CurrBalance();
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

  const load_CurrActual = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_ACTUAL, { find_date: dayjs(new Date(year, month+1)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let data = response.data;  
    let myTotalCurr = 0;
    const tmpData = [...budgetData] as BudgetNodeData[]; 
  
    for (let i=0; i < data.length; i++) {
      let found = false;
      for (let j=0; j < tmpData.length; j++) {
        if (data[i].envelopeID === tmpData[j].envID) {
          found = true;
          tmpData[j] = Object.assign(tmpData[j], { currActual: data[i].totalAmt });
        }
      }
      if (!found) {
        myTotalCurr += data[i].totalAmt;
      }
    };
  
    setCurTotalActualUndefined(myTotalCurr);
    setBudgetData(tmpData as BudgetNodeData[]); 
    setLoadedCurrActual(true);     
  };

  const load_MonthlyAvg = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_MONTHLY_AVG, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let data = response.data;  
    const tmpData = [...budgetData] as BudgetNodeData[]; 
    
    let firstDate = new Date();
    for (let i=0; i < data.length; i++) {
      const tmpDate = new Date(data[i].firstDate);
      if (tmpDate < firstDate) {
        firstDate = tmpDate;
      }
    }
    const curDate = new Date(year, month);
    const numMonths = monthDiff(firstDate, curDate)+1;
    
    if (numMonths > 0) {
      for (let i=0; i < data.length; i++) {
        for (let j=0; j < tmpData.length; j++) {
          if (data[i].envelopeID === tmpData[j].envID) {
            const ttmAvg = data[i].totalAmt / numMonths;
            tmpData[j] = Object.assign(tmpData[j], { monthlyAvg: ttmAvg });
          }
        }
      };
      
      setBudgetData(tmpData as BudgetNodeData[]); 
    }
    setLoadedMonthlyAvg(true);     
  };
  
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

      for (let i=0; i < data.length; i++) {
        data[i] = {...data[i], ...defaultValues} as BudgetNodeData;
      };
      const sortedData = Object.values(data).sort(compare) as BudgetNodeData[];
      setBudgetData(sortedData as BudgetNodeData[]);
    }
  }

  const set_color = (target, actual) => {
    if (actual > target) {
      return '#dd8888'
    } else if (actual <= target) {
      return 'none'
    }
  }

  useEffect(() => {
    if (gotMonthData) {
      setLoadedEnvelopes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth]);  

  useEffect(() => {
    get_totals();
    if (budgetData?.length > 0) {
       if (!loadedEnvelopes) {
        setLoadedEnvelopes(true);
      } else {
        setData({nodes:budgetData});
      }
    } else {
      load_initialEnvelopes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetData]);

  useEffect(() => {
    // Once we have the main table data, we can go get
    // the details and fill it in.
    if (loadedEnvelopes) {
      if (budgetData?.length > 0) {      
        load_CurrBudget();
      }
    } else {
      // We must be re-setting due to a month selection change.
      // Lets wipe this out and force it to start over.
      setLoaded(false);
      setLoadedPrevBudget(false);
      setLoadedCurrBudget(false);
      setLoadedPrevActual(false);
      setLoadedCurrBalance(false);
      setLoadedCurrActual(false);
      setLoadedMonthlyAvg(false);
      setBudgetData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedEnvelopes]);

  useEffect(() => {
    if (loadedCurrBudget) {      
      load_PrevBudget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedCurrBudget]);

  useEffect(() => {
    if (loadedPrevBudget) {      
      load_PrevActual();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPrevBudget]);

  useEffect(() => {
    if (loadedPrevActual) {      
      load_CurrBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPrevActual]);

  useEffect(() => {
    if (loadedCurrBalance) {      
      load_CurrActual();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedCurrBalance]);

  useEffect(() => {
    if (loadedCurrActual) {      
      load_MonthlyAvg();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedCurrActual]);

  useEffect(() => {
    if (Object.keys(data).length > 0 &&
      loadedEnvelopes &&
      loadedCurrBudget &&
      loadedPrevBudget &&
      loadedPrevActual &&
      loadedCurrBalance &&
      loadedCurrActual &&
      loadedMonthlyAvg) {
      
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedMonthlyAvg]);

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
        {gotMonthData && loaded &&
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
      </div>
    </div>
  );
}