import React, { useState, useEffect } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import * as dayjs from 'dayjs';
import { Button, Box, Typography, Paper } from '@mui/material';
import Modal from '@mui/material/Modal';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import LinearProgressWithLabel from '@mui/material/LinearProgress';
import { PlaidLinkOptions, usePlaidLink, 
  PlaidLinkOnSuccess,
  PlaidLinkOnExit } from 'react-plaid-link';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from '@mui/icons-material/Info';
import { EditText } from 'react-edit-text';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'fit-content',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

/* 
  TODO:
  - Update list of accounts after adding new one
*/

export const ConfigPlaid = () => {
  const { config } = useAuthToken();
  
  // Modal popup variables when force getting transactions
  const [open, setOpen] = useState(false);
  const [getStart, setGetStart] = React.useState('');
  const [getEnd, setGetEnd] = React.useState('');
  const [getAcc, setGetAcc] = React.useState<any>(null);

  // Hold any error messages
  const [link_Error, setLink_Error] = useState<string | null>(null);
  
  // List of all the acocunts
  const [PLAIDAccounts, setPLAIDAccounts] = useState<PLAIDAccount[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  
  // Get transactions progress bar
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = React.useState(0);
  
  // PLAID link token
  const [token, setToken] = useState<string | null>(null);
  
  // PLAID update config
  const [updateConfig, setUpdateConfig] = React.useState<any>(null);
  
  // Used to track if the popup modal is open or closed.
  // That modal is used to enter start/end dates to force
  // get specific transactions.
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  interface PLAIDAccount {
    id: number; 
    institution: string;
    account_id: string; 
    mask: string;
    account_name: string;
    account_subtype: string;
    account_type: string;
    verification_status: string;
    item_id: string; 
    access_token: string;
    cursor: number;
    lastTx: number;
    full_account_name: string;
    common_name: string;
  }

  const createLinkToken = async () => {
    if (!config) return;
    const response = await axios.post(baseUrl + channels.PLAID_GET_TOKEN, null, config );
    
    // Receive the data
    let data = response.data;
    if (data.link_token?.length) {
      setToken(data.link_token);
      setLink_Error(null);
    }
    if (data.error_message?.length) {
      console.log(data);
      setLink_Error("Error: " + data.error_message);
    }
  };

  const getAccountList = async () => {
    await createLinkToken();
    try {
      if (!config) return;
      const response = await axios.post(baseUrl + channels.PLAID_GET_ACCOUNTS, null, config );
      // Receive the data
      const myAccounts = response.data as PLAIDAccount[];
  
      // Set the full_account_name
      const transformedData = myAccounts.map(item => {
        return {
          ...item,
          full_account_name: item.account_name + (item.mask ? ('-' + item.mask ) : ''),
        };
      });
  
      setPLAIDAccounts(transformedData);

      setInstitutions(Array.from(new Set(myAccounts.map(acc => acc.institution))));

    } catch (error) {
      console.error("Error creating link token:", error);
    }
  };

  const update_login = async (institution: string) => {
    const filtered = PLAIDAccounts.filter((a) => a.institution === institution);
    const acc = filtered[0];

    if (!config) return;
    const response = await axios.post(baseUrl + channels.PLAID_UPDATE_LOGIN, { access_token: acc.access_token }, config);
    
    let { link_token, error } = response.data;

    if (link_token) {
      get_updated_login(link_token);
    }
    if (error) {
      setLink_Error(error);
    }
  }

  const remove_login = async (institution: string) => {
    const filtered = PLAIDAccounts.filter((a) => a.institution === institution);
    const acc = filtered[0];
    if (token) {
      if (acc.access_token.includes('production') && !token.includes('production')) {
        setLink_Error('You are trying to remove a production login but you have development link token.');
        return;
      }
      if (acc.access_token.includes('development') && !token.includes('development')) {
        setLink_Error('You are trying to remove a development login but you have production link token.');
        return;
      }
      
      if (!config) return;
      await axios.post(baseUrl + channels.PLAID_REMOVE_LOGIN, 
        { access_token: acc.access_token }, config);

      getAccountList();
    } else {
      setLink_Error('You need a link token to remove a plaid account login.');
    }
  }

  const get_transactions = async (institution: string) => {
    const filtered = PLAIDAccounts.filter((a) => a.institution === institution);
    const acc = filtered[0];

    // Clear error message
    setLink_Error(null);
    
    if (!config) return;

    // Get transactions
    setProgress(0);
    setDownloading(true);
    const response = await axios.post(baseUrl + channels.PLAID_GET_TRANSACTIONS, 
      {
        access_token: acc.access_token,
        cursor: acc.cursor,
      }, config);
    
    if (response.status === 200) {
      const sessionId = response.data.sessionId;
      initializeEventSource(sessionId);
    }
  };

  
  const initializeEventSource = (sessionId) => {
    const es = new EventSource(`${baseUrl}${channels.PROGRESS}?sessionId=${sessionId}`);
    setEventSource(es);

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);

      if (data.progress >= 100) {
        setDownloading(false);
        es.close();
        getAccountList();
        setEventSource(null);
      }
    };

    const handleError = (error) => {
      es.close();
      setDownloading(false);
      setEventSource(null);
    };

    es.addEventListener('message', handleMessage);
    es.addEventListener('error', handleError);

    return () => {
      if (eventSource) {
        eventSource.removeEventListener('message', handleMessage);
        eventSource.removeEventListener('error', handleError);
        eventSource.close();
        setDownloading(false);
      }
    };
  };

  const force_get_transactions = async (acc : PLAIDAccount, start_date, end_date) => {
    handleClose();

    // Clear error message
    setLink_Error(null);
    
    if (!config) return;
    
    // Get transactions
    setProgress(0);
    setDownloading(true);
    const response = await axios.post(baseUrl + channels.PLAID_FORCE_TRANSACTIONS, 
      { access_token: acc.access_token,
        start_date: start_date,
        end_date: end_date
      }, config
    );
    
    if (response.status === 200) {
      const sessionId = response.data.sessionId;
      initializeEventSource(sessionId);
    }
  };

  const onSuccess: PlaidLinkOnSuccess = (public_token, metadata) => {
    console.log("Success linking new account. ");
    
    console.log("public token: ", public_token);
    console.log("metadata: ", metadata);
    
    metadata.accounts.forEach((account, index) => {
      console.log("Account: ", metadata?.institution?.name, " : ", account.name);
    });

    if (!config) return;
    axios.post(baseUrl + channels.PLAID_SET_ACCESS_TOKEN, {public_token, metadata}, config);
  };

  const onExit: PlaidLinkOnExit = (error, metadata) => {
    // log onExit callbacks from Link, handle errors
    // https://plaid.com/docs/link/web/#onexit
    console.log("Error:", error, metadata);
    if (error) {
      setLink_Error("Error: " + error.error_message);
    }
  };

  const get_updated_login = async (updateToken) => {
    const updateConfig: PlaidLinkOptions = {
      token: updateToken,
      onSuccess: (public_token, metadata) => {
        setUpdateConfig(null);
        // You do not need to repeat the /item/public_token/exchange
        // process when a user uses Link in update mode.
        // The Item's access_token has not changed.
        console.log("Success updating login", public_token, metadata);
      },
      onExit: (err, metadata) => {
        setUpdateConfig(null);
        //console.log("onExit: ", metadata);
        // The user exited the Link flow.
        if (err != null) {
          // The user encountered a Plaid API error prior
          // to exiting.
          //console.log("Error on exit: ", err);
          setLink_Error(err.display_message);
        }
        // metadata contains the most recent API request ID and the
        // Link session ID. Storing this information is helpful
        // for support.
      },
    };

    //console.log("created plaid link options: ", updateConfig);

    setUpdateConfig(updateConfig);
  } 

  const UpdatePlaid = () => {
    const { open: openUpdate, ready: readyUpdate } = usePlaidLink(updateConfig);

    useEffect(() => {
      if (readyUpdate) {
        //console.log("calling plaid link to update login");
        openUpdate();
      }
    }, [readyUpdate, openUpdate]);

    return (
      <></>
    );
  };

  const { open: openLink, ready: readyLink } = usePlaidLink({
    token: token,
    onSuccess: onSuccess,
    onExit: onExit,
  });

 
  useEffect(() => {
    if (!accountsLoaded) {
      setAccountsLoaded(true);
      getAccountList();
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <>
  {link_Error && 
    <div className="Error"><br/>{link_Error}</div>
  }
  <>
    {token &&
      <Box>
        
          { updateConfig && <UpdatePlaid/>}
          <Button variant="contained" className='textButton' onClick={() => openLink()} disabled={!readyLink} style={{ marginBottom: '20px' }}>
            Connect a new account
          </Button>

          { downloading && 
            <Box sx={{ width: '100%' }}>
              <LinearProgressWithLabel variant="determinate" value={progress} style={{ marginBottom: '20px' }} />
            </Box>
          }
          { institutions.map(institution => (
            <Paper key={institution} style={{ marginBottom: '20px' }}>
              <Box className="institution-header">
                <Typography variant="h6">{institution}</Typography>
                <Box>
                  <Button variant="contained" className='textButton' onClick={() => remove_login(institution)} disabled={!token} style={{ marginRight: '10px' }}>
                    Remove
                  </Button>
                  <Button variant="contained" className='textButton' onClick={() => update_login(institution)} disabled={!token}>
                    Update Login
                  </Button>
                </Box>
              </Box>
              <Box className="account-container">
                <Box className="account-list">
                {PLAIDAccounts.filter(acc => acc.institution === institution).map(acc => (
                  <Box key={acc.account_name + '-' + acc.mask} className="account-details">
                    <Tooltip title={ acc.full_account_name } placement="top" sx={{ flex: '1 0' }}
                      slotProps={{
                        popper: {
                          modifiers: [
                            {
                              name: 'offset',
                              options: {
                                offset: [0, -14],
                              },
                            },
                          ],
                        },
                      }}>
                      <Typography variant="body1" sx={{ flex: '1 0', textAlign: 'left' }}>
                        <EditText
                          name={ acc.id.toString() }
                          defaultValue={ acc.common_name }
                          onSave={({name, value, previousValue}) => {
                            // Request we rename the account in the DB
                            if (!config) return;
                            axios.post(baseUrl + channels.UPDATE_ACCOUNT, { id: acc.id, new_value: value }, config);
                          }}
                          style={{padding: '0px', margin: '0px', minHeight: '1rem'}}
                          className={"editableText"}
                          inputClassName={"normalInput"}
                        />
                      </Typography>
                    </Tooltip>
                    <Typography variant="body2" color="textSecondary" sx={{ marginLeft: '4px', width: 'fit-content', flex: '0 0' }}>
                      { acc.lastTx && dayjs(acc.lastTx).format('M/D/YYYY') }
                    </Typography>
                    { acc.lastTx && (
                      <Tooltip title="Last transaction date" sx={{ width: 'fit-content', flex: '0 0' }}>
                        <InfoIcon fontSize="small" sx={{ marginLeft: '4px', color: 'grey.500', opacity: 0.7 }} />
                      </Tooltip>
                    )}
                  </Box>
                ))}
                </Box>
                <Box className="account-buttons">
                  <Button variant="outlined" className='plaid-update-button' onClick={() => get_transactions(institution)} disabled={!token}  style={{ marginBottom: '5px' }}>
                    Update Latest
                  </Button>
                  <Button variant="outlined" 
                    className='plaid-update-button'
                    onClick={() => {
                      // Get the latest transaction date for this account
                      const filtered = PLAIDAccounts.filter((a) => a.institution === institution);
                      const only_dates = filtered.map((a) => new Date(a.lastTx + 'T00:00:00').getTime());
                      const max_date = Math.max(...only_dates);
                      const max_date_str = dayjs(max_date).format('YYYY-MM-DD');
                      if (max_date_str) {
                        setGetStart(max_date_str);
                      } else {
                        setGetStart(dayjs().startOf('month').format("YYYY-MM-DD"));
                      }
                      setGetEnd(dayjs().format("YYYY-MM-DD"));
                      setGetAcc(filtered[0]);
                      
                      handleOpen();
                    }} 
                    disabled={!token}>
                    Update by Date
                  </Button>
                </Box>
              </Box>
            </Paper>
          ))}
        
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style}>
            Get transactions<br/>
            <table><tbody>
            <tr>
              <td>from:</td>
              <td>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={dayjs(getStart)}
                  onChange={(newValue) => {
                    const new_date = newValue ? newValue.format("YYYY-MM-DD") : '';
                    setGetStart(new_date);
                  }}
                  sx={{ width:150, pr:0 }}
                  />
                </LocalizationProvider>
              </td>
            </tr>
            <tr>
              <td>to:</td>
              <td>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={dayjs(getEnd)}
                  onChange={(newValue) => {
                    const new_date = newValue ? newValue.format("YYYY-MM-DD") : '';
                    setGetEnd(new_date);
                  }}
                  sx={{ width:150, pr:0 }}
                  />
                </LocalizationProvider>
              </td>
            </tr>
            </tbody></table>
            <br/>
            <button 
              className='textButton'
              onClick={() => {
                force_get_transactions(getAcc, getStart, getEnd);
              }} 
              disabled={!token}>
              Get Those Transactions!
            </button>
          </Box>
        </Modal>
      </Box>
    }
  </>
  </>
  );
};

export default ConfigPlaid;