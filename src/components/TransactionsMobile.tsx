import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import * as dayjs from 'dayjs'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { useParams } from 'react-router';
import { Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { Button, IconButton } from '@mui/material';
import Grid from '@mui/material/Grid2';
import ClearIcon from '@mui/icons-material/Clear';
import { FooterMobile } from './FooterMobile.tsx';


/*
  TODO:
  - better way to pass in parameters?
  - better default parameter values (vs using -1, etc)
  - consolidate tx filter local storage
*/

export const TransactionsMobile: React.FC = () => {
  const { config } = useAuthToken();
  
  const { in_catID, in_envID, in_force_date, in_year, in_month } = useParams();
 
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

  // Filter by category
  const [filterCatList, setFilterCatList] = useState<any[]>([]);
  const [filterCatListLoaded, setFilterCatListLoaded] = useState(false);
  const [filterCatID, setFilterCatID] = useState(in_catID);

  // Filter by envelope
  const [filterEnvList, setFilterEnvList] = useState<any[]>([]);
  const [filterEnvListLoaded, setFilterEnvListLoaded] = useState(false);
  const [filterEnvID, setFilterEnvID] = useState(in_envID);

  // Filter by account
  const [filterAccList, setFilterAccList] = useState<any[]>([]);
  const [filterAccListLoaded, setFilterAccListLoaded] = useState(false);
  const [filterAccID, setFilterAccID] = useState("All");
  //const [filterAccName, setFilterAccName] = useState(null);

  // Filter by description
  const [filterDesc, setFilterDesc] = useState('');
  const [filterDescTemp, setFilterDescTemp] = useState('');

  // Filter by amount
  const [filterAmount, setFilterAmount] = useState('');
  const [filterAmountTemp, setFilterAmountTemp] = useState('');
  
  // Filter by Date
  const [filterStartDate, setFilterStartDate] = useState<Dayjs | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Dayjs | null>(null);

  // Category : Envelope data for drop down lists
  const [envList, setEnvList] = useState<any[]>([]);
  const [envListLoaded, setEnvListLoaded] = useState(false);
  
  // Import filename
  const [filename, setFilename] = useState('');
  const [uploading, ] = useState(false);
  const [progress, ] = React.useState(0);

  // Export 
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);

  // Transaction data
  const [txData, setTxData] = useState<any[]>([]);

  
  const [basicLoaded, setBasicLoaded] = useState(false);
  const [accLoaded, setAccLoaded] = useState(false);
  const [envLoaded, setEnvLoaded] = useState(false);

  const isValidDate = (date: any): date is Dayjs | null => {
    return (dayjs.isDayjs(date) && date.isValid()) || date === null;
  };
  const clearStartDate = () => {
    setFilterStartDate(null);
  };
  const clearEndDate = () => {
    setFilterEndDate(null);
  };

  const load_transactions = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_TX_DATA, 
      { filterStartDate : filterStartDate?.format('YYYY-MM-DD'),
        filterEndDate: filterEndDate?.format('YYYY-MM-DD'),
        filterCatID: filterCatID,
        filterEnvID: filterEnvID,
        filterAccID: filterAccID,
        filterDesc: filterDesc,
        filterAmount: filterAmount }, config);
    
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

    setEnvList([{ id: -1, text: "Undefined"}, ...(tmpFilterEnvList)]);
    setEnvListLoaded(true);

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

  function nthIndex(str, pat, n){
    var L= str.length, i= -1;
    while(n-- && i++<L){
        i= str.indexOf(pat, i);
        if (i < 0) break;
    }
    return i;
  }

  const handleFilterCatChange = ({id, new_value, new_text}) => {
    localStorage.setItem(
      'transaction-filter-catID', 
      JSON.stringify({ filterCatID: new_value})
    );
    setFilterCatID(new_value);
  };

  const handleFilterEnvChange = ({id, new_value, new_text}) => {
    localStorage.setItem(
      'transaction-filter-envID', 
      JSON.stringify({ filterEnvID: new_value})
    );
    setFilterEnvID(new_value);
  };

  const handleFilterAccChange = ({id, new_value, new_text}) => {
    localStorage.setItem(
      'transaction-filter-accID', 
      JSON.stringify({ filterAccID: new_value})
    );
    setFilterAccID(new_value);
  };

  const handleFilterDescChange = () => {
    localStorage.setItem(
      'transaction-filter-desc', 
      JSON.stringify({ filterDesc: filterDescTemp})
    );
    setFilterDesc(filterDescTemp);
  };  

  const handleFilterAmountChange = () => {
    localStorage.setItem(
      'transaction-filter-amount', 
      JSON.stringify({ filterAmount: filterAmountTemp})
    );
    setFilterAmount(filterAmountTemp);
  }; 

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

  useEffect(() => {
    if (filterStartDate) {
      localStorage.setItem(
        'transaction-filter-startDate',
        JSON.stringify({ filterStartDate: filterStartDate.format('YYYY-MM-DD') })
      );
    } else {
      if (basicLoaded) {
        localStorage.removeItem('transaction-filter-startDate');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStartDate]);

  useEffect(() => {
    if (filterEndDate) {
      localStorage.setItem(
        'transaction-filter-endDate',
        JSON.stringify({ filterEndDate: filterEndDate.format('YYYY-MM-DD') })
      );
    } else {
      if (basicLoaded) {
        localStorage.removeItem('transaction-filter-endDate');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEndDate]);

  useEffect(() => {
    if (basicLoaded && accLoaded && envLoaded) {
      load_transactions();
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCatID, filterEnvID, filterAccID, filterDesc,
      filterStartDate, filterEndDate, filterAmount,
      basicLoaded, accLoaded, envLoaded]);

  useEffect(() => {
    const my_filter_startDate_str = localStorage.getItem('transaction-filter-startDate');
    if (my_filter_startDate_str?.length) {
      const my_filter_startDate = JSON.parse(my_filter_startDate_str);
      if (my_filter_startDate?.filterStartDate) {
        const my_tmpStartDate = dayjs(my_filter_startDate.filterStartDate);
        setFilterStartDate(my_tmpStartDate);        
      }
    }

    const my_filter_endDate_str = localStorage.getItem('transaction-filter-endDate');
    if (my_filter_endDate_str?.length) {
      const my_filter_endDate = JSON.parse(my_filter_endDate_str);
      if (my_filter_endDate?.filterEndDate) {
        const my_tmpEndDate = dayjs(my_filter_endDate.filterEndDate);
        setFilterEndDate(my_tmpEndDate);
      }
    }

    const my_filter_catID_str = localStorage.getItem('transaction-filter-catID');
    if (my_filter_catID_str?.length) {
      const my_filter_catID = JSON.parse(my_filter_catID_str);
      if (my_filter_catID) {
        if (in_catID === "-1" && my_filter_catID.filterCatID) {
          setFilterCatID(my_filter_catID.filterCatID);
        }
      }
    }

    const my_filter_envID_str = localStorage.getItem('transaction-filter-envID');
    if (my_filter_envID_str?.length) {
      const my_filter_envID = JSON.parse(my_filter_envID_str);
      if (my_filter_envID) {
        if (in_envID === "-3" && my_filter_envID.filterEnvID) {
          setFilterEnvID(my_filter_envID.filterEnvID);
        }
      }
    }
      
    const my_filter_accID_str = localStorage.getItem('transaction-filter-accID');
    if (my_filter_accID_str?.length) {
      const my_filter_accID = JSON.parse(my_filter_accID_str);
      if (my_filter_accID) {
        setFilterAccID(my_filter_accID.filterAccID);
      }
    }
      
    const my_filter_desc_str = localStorage.getItem('transaction-filter-desc');
    if (my_filter_desc_str?.length) {
      const my_filter_desc = JSON.parse(my_filter_desc_str);
      if (my_filter_desc) {
        setFilterDescTemp(my_filter_desc.filterDesc);
        setFilterDesc(my_filter_desc.filterDesc);
      }
    }
      
    const my_filter_amount_str = localStorage.getItem('transaction-filter-amount');
    if (my_filter_amount_str?.length) {
      const my_filter_amount = JSON.parse(my_filter_amount_str);
      if (my_filter_amount) {
        setFilterAmountTemp(my_filter_amount.filterAmount);
        setFilterAmount(my_filter_amount.filterAmount);
      }
    }

    if (in_force_date === "1" && in_year && in_month) {
      let tmpStartDate = dayjs(new Date(parseInt(in_year), parseInt(in_month)));
      let tmpEndDate = dayjs(new Date(parseInt(in_year), parseInt(in_month)+1,0));
      setFilterStartDate(tmpStartDate);
      setFilterEndDate(tmpEndDate);
      localStorage.setItem(
        'transaction-filter-startDate', 
        JSON.stringify({ filterStartDate: tmpStartDate?.format('YYYY-MM-DD')}));
      localStorage.setItem(
        'transaction-filter-endDate', 
        JSON.stringify({ filterEndDate: tmpEndDate?.format('YYYY-MM-DD')}));

      // If we came in from a link, we should clear out any other filters
      setFilterAccID("All");
      setFilterAmountTemp("");
      setFilterAmount("");
      setFilterDescTemp("");
      setFilterDesc("");
    }
    
    load_envelope_list();
    load_account_list();
    setBasicLoaded(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
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
            <table><tbody>
              <tr>
                <td className="Right">
                  <span>Start Date: </span>
                </td>
                <td className="Left">
                  <span className="filterSize">
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      value={filterStartDate}
                      onChange={(newValue) => {
                        if (isValidDate(newValue)) {
                          setFilterStartDate(newValue)
                                                    
                          if (filterEndDate && newValue && filterEndDate.diff(newValue) <= 0 ) {
                            setFilterEndDate(newValue?.add(1, 'day'));
                          }
                        }
                      }}
                      sx={{ border: 'none' }}
                    />
                  </LocalizationProvider>
                  <IconButton onClick={clearStartDate} aria-label="clear date">
                    <ClearIcon />
                  </IconButton>
                  </span>
                </td>
                <td width="50"></td>
                <td className="Right">
                  <span>Description: </span>
                </td>
                <td className="Left">
                  <input
                    name="filterDescTemp"
                    defaultValue={filterDescTemp}
                    onChange={(e) => {
                      setFilterDescTemp(e.target.value);
                    }}
                    onBlur={handleFilterDescChange}
                    className="inputField filterSize"
                  />
                </td>
              </tr>
              <tr>
                <td className="Right">
                  <span>End Date: </span>
                </td>
                <td className="Left">
                  <span className="filterSize">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DatePicker
                        value={filterEndDate}
                        onChange={(newValue) => {
                          if (isValidDate(newValue)) {
                            setFilterEndDate(newValue);
                          }
                        }}
                        sx={{ border: 'none' }}
                      />
                    </LocalizationProvider>
                    <IconButton onClick={clearEndDate} aria-label="clear date">
                      <ClearIcon />
                    </IconButton>
                  </span>
                </td>
                <td></td>
                <td className="Right">
                  <span>Amount: </span>
                </td>
                <td className="Left">
                  <input
                      name="filterAmountTemp"
                      defaultValue={filterAmountTemp}
                      onChange={(e) => {
                        setFilterAmountTemp(e.target.value);
                      }}
                      onBlur={handleFilterAmountChange}
                      className="inputField filterSize"
                    />
                </td>
              </tr>
              <tr>
                <td className="Right">
                  <span>Category: </span>
                </td>
                <td className="Left">
                  <DropDown 
                    id={-1}
                    selectedID={filterCatID}
                    optionData={filterCatList}
                    changeCallback={handleFilterCatChange}
                    className="selectField selectFilterSize"
                  />
                </td>
                <td></td>
                <td className="Right">
                  <span>Envelope: </span>
                </td>
                <td className="Left">
                  <DropDown 
                    id={-1}
                    selectedID={filterEnvID}
                    optionData={filterEnvList}
                    changeCallback={handleFilterEnvChange}
                    className="selectField selectFilterSize"
                  />
                </td>
              </tr>
              <tr>
                <td className="Right">
                  <span>Account: </span>
                </td>
                <td className="Left">
                  <DropDown 
                    id={-1}
                    selectedID={filterAccID}
                    optionData={filterAccList}
                    changeCallback={handleFilterAccChange}
                    className="selectField selectFilterSize"
                  />
                </td>
              </tr>
              </tbody></table>
          </AccordionDetails>
          </Accordion>
        }
        <br/>
        {envListLoaded &&
          txData.map((tx, index, myArray) => (
          <React.Fragment key={index}>
              { (index === 0 || (index > 0 && tx.txDate !== myArray[index - 1].txDate)) && (
                <div className='mobile-tx-date'>{ dayjs(tx.txDate).format('MMM D, YYYY') }</div>
              )}
              <div className='mobile-tx-container'>
                <div className='mobile-tx-header'>
                  <span className='mobile-tx-description'>{tx.description}</span>
                  <span className='mobile-tx-amt'>{formatCurrency(tx.txAmt)}</span>
                </div>
                <div className='mobile-tx-envelope'>
                  <span>{tx.envelope}</span>
                </div>
              </div>
            </React.Fragment>
          ))
        }
      </div>
      <FooterMobile defaultValue={0} />
    </>
  );
}