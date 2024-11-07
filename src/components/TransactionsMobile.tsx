import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import * as dayjs from 'dayjs'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { Button, IconButton } from '@mui/material';
import Grid from '@mui/material/Grid2';
import ClearIcon from '@mui/icons-material/Clear';
import { FooterMobile } from './FooterMobile.tsx';
import { HeaderMobile } from './headerMobile.tsx';


/*
  TODO:
  - better way to pass in parameters?
  - better default parameter values (vs using -1, etc)
  - consolidate tx filter local storage
*/

export const TransactionsMobile: React.FC = () => {
  const { config } = useAuthToken();
  
  // Add new Transaction values
  const [newTxDate, setNewTxDate] = useState<Dayjs | null>(dayjs(new Date()));
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxAmountTemp, ] = useState('');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxDescTemp, ] = useState('');
  const [newTxAccList, setNewTxAccList] = useState<any[]>([]);
  const [newTxAccID, setNewTxAccID] = useState(-1);
  const [newTxEnvList, setNewTxEnvList] = useState<any[]>([]);
  const [newTxEnvID, setNewTxEnvID] = useState(-1);
  const [newTxEnvListLoaded, setNewTxEnvListLoaded] = useState(false);
  const [newTxAccListLoaded, setNewTxAccListLoaded] = useState(false);
  const [newError, setNewError] = useState("");

  const initialFilters = {
    startDate: dayjs().startOf('month').toISOString(),
    endDate: dayjs().toISOString(),
    catID: -1,
    envID: -3,
    accID: "All",
    desc: '',
    amount: ''
  };
  const [filters, setFilters] = useState(initialFilters);

  // Filter by category
  const [filterCatList, setFilterCatList] = useState<any[]>([]);
  const [filterCatListLoaded, setFilterCatListLoaded] = useState(false);

  // Filter by envelope
  const [filterEnvList, setFilterEnvList] = useState<any[]>([]);
  const [filterEnvListLoaded, setFilterEnvListLoaded] = useState(false);

  // Filter by account
  const [filterAccList, setFilterAccList] = useState<any[]>([]);
  const [filterAccListLoaded, setFilterAccListLoaded] = useState(false);

  // Transaction data
  const [txData, setTxData] = useState<any[]>([]);
  
  const [basicLoaded, setBasicLoaded] = useState(false);
  const [accLoaded, setAccLoaded] = useState(false);
  const [envLoaded, setEnvLoaded] = useState(false);

  const [visibleItems, setVisibleItems] = useState(10); 

  const loadMore = () => {
    setVisibleItems((prev) => prev + 10); // Load 10 more items
  };

  const isValidDate = (date: any): date is Dayjs | null => {
    return (dayjs.isDayjs(date) && date.isValid()) || date === null;
  };

  const updateFilters = (newFilterValues) => {
    const updatedFilters = { ...filters, ...newFilterValues };
    setFilters(updatedFilters);
    localStorage.setItem('filterSettings', JSON.stringify(updatedFilters));
  };
  
  const load_transactions = async () => {
    // Signal we want to get data
    if (!config) return;

    const my_filters = {
      filterStartDate : filters.startDate ? dayjs(filters.startDate)?.format('YYYY-MM-DD') : null,
      filterEndDate: filters.endDate ? dayjs(filters.endDate)?.format('YYYY-MM-DD') : null,
      filterCatID: filters.catID,
      filterEnvID: filters.envID,
      filterAccID: filters.accID,
      filterDesc: filters.desc,
      filterAmount: filters.amount
    };

    const response = await axios.post(baseUrl + channels.GET_TX_DATA, 
      my_filters, config);
    
    // Receive the data
    const tmpData = [...response.data]; 
    setTxData(tmpData);
  }

  const load_envelope_list = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ENV_CAT, {onlyActive: 0}, config);

    // Receive the data
    let firstID = -1;
    const tmpFilterEnvList = response.data.map((item, index) => {
      if (index === 0) {
        firstID = item.envID;
      }
      return { id: item.envID, text: item.category + " : " + item.envelope };
    });
    
    const tmpFilterCatList = response.data.reduce((acc, item) => {
      // Check if the category id already exists in the accumulator array
      const existingCategory = acc.find(category => category.id === item.catID);
    
      // If not, add the category to the accumulator
      if (!existingCategory) {
        acc.push({
          id: item.catID,
          text: item.category,
        });
      }
    
      return acc;
    }, []);

    setNewTxEnvList(tmpFilterEnvList);
    setNewTxEnvID(firstID);
    setNewTxEnvListLoaded(true);

    setFilterEnvList([
      { id: -3, text: "All" },
      { id: -2, text: "Not in current budget" },
      { id: -1, text: "Undefined" }, ...(tmpFilterEnvList)
    ]);
    setFilterEnvListLoaded(true);

    setFilterCatList([
      { id: -1, text: "All" },
      ...(tmpFilterCatList)
    ]);
    setFilterCatListLoaded(true);
    setEnvLoaded(true);
  }

  const load_account_list = async () => {
    // Signal we want to get data
    if (!config) return;
    const acct_response = await axios.post(baseUrl + channels.GET_ACCOUNTS, null, config);
    
    // Receive the data
    let acct_list = acct_response.data;
    const tmpFiltered = acct_list.filter((item) => {
      return (acct_list.find((i) => {
        return (i.common_name === item.common_name);
      }).id === item.id);
    });
    
    let firstID = -1;
    setNewTxAccList(
      [...(
        tmpFiltered.map(i => {
          if (firstID === -1 && i.isActive) {
            firstID = i.id;
          }
          return { id: i.id, text: i.common_name, isActive: i.isActive }
        })
        .filter(i => i.isActive))
      ]
    );
    setNewTxAccID(firstID);
    setNewTxAccListLoaded(true);
    
    // Signal we want to get data
    if (!config) return;
    const acct_name_response = await axios.post(baseUrl + channels.GET_ACCOUNT_NAMES, null, config);

    // Receive the data
    setFilterAccList([{
      id: "All", text: "All"
    }, ...(acct_name_response.data.map((i) => {
      return { id: i.common_name, text: i.common_name }
    }))]);
    setFilterAccListLoaded(true);
    setAccLoaded(true);
  }

  function formatCurrency(currencyNumber:number) {
    if (currencyNumber === null) {
      // TODO: why are we getting a null value?
      console.log("WARNING: we were asked to convert a null number to a currency string.");
      let tmpNumber = 0;
      return tmpNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
    }
    return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
  }

  const add_new_transaction = async () => {
    let errorMsg = "";
    if (newTxAmount?.length === 0) {
      errorMsg += "You must enter an amount.  ";
    } else {
      if (isNaN(parseFloat(newTxAmount))) {
        errorMsg += "You must enter a valid amount. ";
      }
    }
    if (newTxDesc?.length === 0) {
      errorMsg += "You must enter a description. ";
    }
    if (errorMsg?.length > 0) {
      setNewError(errorMsg);
      return;
    }
    
    if (!config) return;
    const params =  
    {
      txDate: newTxDate?.format('YYYY-MM-DD'),
      txAmt: newTxAmount,
      txEnvID: newTxEnvID,
      txAccID: newTxAccID,
      txDesc: newTxDesc
    };
    await axios.post(baseUrl + channels.ADD_TX, params, config);

    load_transactions();      
  }

  const clearStartDate = () => {
    updateFilters({ startDate: '' });
  };
  
  const clearEndDate = () => {
    updateFilters({ endDate: '' });
  };
  
  useEffect(() => {
    if (basicLoaded) {
      if (filters.startDate) {
        localStorage.setItem('filterSettings', JSON.stringify({ ...filters, startDate: filters.startDate }));
      } else {
        if (basicLoaded) {
          const updatedFilters = { ...filters, startDate: '' };
          setFilters(updatedFilters);
          localStorage.setItem('filterSettings', JSON.stringify(updatedFilters));
        }
      }
    }
  }, [filters.startDate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    if (basicLoaded) {
      if (filters.endDate) {
        localStorage.setItem('filterSettings', JSON.stringify({ ...filters, endDate: filters.endDate }));
      } else {
        if (basicLoaded) {
          const updatedFilters = { ...filters, endDate: '' };
          setFilters(updatedFilters);
          localStorage.setItem('filterSettings', JSON.stringify(updatedFilters));
        }
      }
    }
  }, [filters.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (basicLoaded && accLoaded && envLoaded) {
      load_transactions();
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, basicLoaded, accLoaded, envLoaded]);

  useEffect(() => {
    const savedFilters = localStorage.getItem('filterSettings');
    if (savedFilters) {
      setFilters(JSON.parse(savedFilters));
    }

    load_envelope_list();
    load_account_list();
    setBasicLoaded(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="App-header">
        <HeaderMobile currTab="Transaction"/>
      </div>
      <div className="main-page-body-text-mobile">
        { newTxEnvListLoaded && newTxAccListLoaded &&
          <Accordion>
          <AccordionSummary
            expandIcon={<FontAwesomeIcon icon={faChevronDown} />}
            aria-controls="filter-content"
            id="filter-header"
            sx={{pl:1, pr:1, m:0, mt:-1}}
          >
            Add Transaction
          </AccordionSummary>
          <AccordionDetails sx={{textAlign: 'left'}}>
            <>
              <Grid container spacing={1} alignItems="center" columns={4}>
                <Grid size={1} style={{ textAlign: 'right' }}>
                  Date:
                </Grid>
                <Grid size={3}>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      value={newTxDate}
                      onChange={(newValue) => setNewTxDate(newValue)}
                      sx={{ width: 150, pr: 0 }}
                    />
                  </LocalizationProvider>
                </Grid>
                
                <Grid size={1} style={{ textAlign: 'right' }}>
                  Account:
                </Grid>
                <Grid size={3}>
                  <DropDown
                    id={-1}
                    selectedID={newTxAccID}
                    optionData={newTxAccList}
                    changeCallback={({ id, new_value, new_text }) => setNewTxAccID(new_value)}
                    className="selectField"
                  />
                </Grid>
                
                <Grid size={1} style={{ textAlign: 'right' }}>
                  Description:
                </Grid>
                <Grid size={3}>
                  <input
                    name="newTxDescTemp"
                    style={{ width: '250px' }}
                    defaultValue={newTxDescTemp}
                    onBlur={(e) => {
                      setNewTxDesc(e.target.value);
                      setNewError("");
                    }}
                    className={"inputField"}
                  />
                </Grid>
                
                <Grid size={1} style={{ textAlign: 'right' }}>
                  Amount:
                </Grid>
                <Grid size={3}>
                  <input
                    name="newTxAmountTemp"
                    style={{ width: '100px', paddingRight: '5px' }}
                    defaultValue={newTxAmountTemp}
                    onBlur={(e) => {
                      setNewTxAmount(e.target.value);
                      setNewError("");
                    }}
                    className={"inputField Right"}
                  />
                </Grid>
                
                <Grid size={1} style={{ textAlign: 'right' }}>
                  Envelope:
                </Grid>
                <Grid size={3}>
                  <DropDown
                    id={-1}
                    selectedID={newTxEnvID}
                    optionData={newTxEnvList}
                    changeCallback={({ id, new_value, new_text }) => setNewTxEnvID(new_value)}
                    className="selectField"
                  />
                </Grid>
              </Grid>

              <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', alignItems:'center', alignContent: 'center', width: '100%' }}>   
                <Button variant="contained" className='textButton' onClick={() => add_new_transaction()}>
                  Add Transaction
                </Button>       
                
                {newError?.length > 0 &&
                  <span className="Red">Error: {newError}</span>
                }
              </div>
            </>
          </AccordionDetails>
          </Accordion>
        }
        {filterEnvListLoaded && filterAccListLoaded && filterCatListLoaded &&
          <Accordion>
          <AccordionSummary
            expandIcon={<FontAwesomeIcon icon={faChevronDown} />}
            aria-controls="filter-content"
            id="filter-header"
            sx={{pl:1, pr:1, m:0, mt:-1}}
          >
            Filter
          </AccordionSummary>
          <AccordionDetails>
          <Grid container spacing={1} alignItems="center" columns={4}>
            <Grid size={1} style={{ textAlign: 'right' }}>
              Start Date: 
            </Grid>
            <Grid size={3}>
              <span className="filterSize">
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    value={dayjs(filters.startDate)}
                    onChange={(newValue) => {
                      if (isValidDate(newValue)) {
                        updateFilters({ startDate: newValue })
                                                  
                        if (filters.endDate && newValue && dayjs(filters.endDate).diff(newValue) <= 0 ) {
                          updateFilters({ endDate: dayjs(newValue)?.add(1, 'day') });
                        }
                      }
                    }}
                    sx={{ border: 'none' }}
                  />
                </LocalizationProvider>
                <IconButton onClick={clearStartDate} aria-label="clear date" sx={{ padding: '0'}}>
                  <ClearIcon />
                </IconButton>
              </span>
            </Grid>
            <Grid size={1} style={{ textAlign: 'right' }}>
              End Date:
            </Grid>
            <Grid size={3}>
              <span className="filterSize">
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    value={dayjs(filters.endDate)}
                    onChange={(newValue) => {
                      if (isValidDate(newValue)) {
                        updateFilters({ endDate: newValue });
                      }
                    }}
                    sx={{ border: 'none' }}
                  />
                </LocalizationProvider>
                <IconButton onClick={clearEndDate} aria-label="clear date" sx={{ padding: '0'}}>
                  <ClearIcon />
                </IconButton>
              </span>
            </Grid>
            <Grid size={1} style={{ textAlign: 'right' }}>
              Description:
            </Grid>
            <Grid size={3}>
              <input
                name="filterDescTemp"
                defaultValue={filters.desc}
                onBlur={(e) => {
                  updateFilters({ desc: e.target.value });
                }}
                className="inputField filterSize"
              />
            </Grid>
            <Grid size={1} style={{ textAlign: 'right' }}>
              Category:
            </Grid>
            <Grid size={3}>
              <DropDown 
                id={-1}
                selectedID={filters.catID}
                optionData={filterCatList}
                changeCallback={({id, new_value, new_text}) => {
                  updateFilters({ catID: new_value });
                }}
                className="selectField selectFilterSize"
              />
            </Grid>
            <Grid size={1} style={{ textAlign: 'right' }}>
              Envelope:
            </Grid>
            <Grid size={3}>
              <DropDown 
                id={-1}
                selectedID={filters.envID}
                optionData={filterEnvList}
                changeCallback={({id, new_value, new_text}) => {
                  updateFilters({ envID: new_value });
                }}
                className="selectField selectFilterSize"
              />
            </Grid>
            <Grid size={1} style={{ textAlign: 'right' }}>
              Account:
            </Grid>
            <Grid size={3}>
              <DropDown 
                id={-1}
                selectedID={filters.accID}
                optionData={filterAccList}
                changeCallback={({id, new_value, new_text}) => {
                  updateFilters({ accID: new_value });
                }}
                className="selectField selectFilterSize"
              />
            </Grid>
            <Grid size={1} style={{ textAlign: 'right' }}>
              Amount:
            </Grid>
            <Grid size={3}>
              <input
                name="filterAmountTemp"
                defaultValue={filters.amount}
                onBlur={(e) => {
                  updateFilters({ amount: e.target.value });
                }}
                className="inputField filterSize"
              />
            </Grid>
          </Grid> 
          </AccordionDetails>
          </Accordion>
        }
        <br/>
        {
          txData.slice(0, visibleItems).map((tx, index, myArray) => (
          <React.Fragment key={index}>
              { (index === 0 || (index > 0 && tx.txDate !== myArray[index - 1].txDate)) && (
                <div className='mobile-tx-date'>{ dayjs(tx.txDate).format('MMMM D, YYYY') }</div>
              )}
              <div className='mobile-tx-container'>
                <div className='mobile-tx-header'>
                  <span className='mobile-tx-description'>{tx.description}</span>
                  <span className='mobile-tx-amt'>{formatCurrency(tx.txAmt)}</span>
                </div>
                <div className='mobile-tx-envelope'>
                  <span>{tx.category} : {tx.envelope}</span>
                </div>
              </div>
            </React.Fragment>
          ))
        }
        
        { visibleItems < txData.length && (
          <div style={{ paddingTop: '10px', paddingBottom: '10px', display: 'flex', flexDirection: 'column', alignItems:'center', alignContent: 'center', width: '100%' }}>   
            <Button variant="contained" className='textButton' onClick={loadMore}>
              Load More
            </Button>
          </div>
        )}
      </div>
      <FooterMobile defaultValue={0} />
    </>
  );
}