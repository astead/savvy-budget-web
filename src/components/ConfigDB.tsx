import React, { useState, useEffect } from 'react';
import { channels } from '../shared/constants.js';
import { styled } from '@mui/material/styles';
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion';
import MuiAccordionSummary, { AccordionSummaryProps } from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';


/* 
  TODO:
  - Show more DB data? transaction dates, # transactions, # accounts?
  - another cloud DB option?
*/

export const ConfigDB = () => {
  // Accordian
  const [expanded, setExpanded] = React.useState<string | false>('cloud');
  //Radio
  const [selectedValue, setSelectedValue] = React.useState('cloud');

  // Database filename
  const [databaseFile, setDatabaseFile] = useState('');
  const [databaseExists, setDatabaseExists] = useState(false);
  const [databaseVersion, setDatabaseVersion] = useState(null);
  const [databaseError, setDatabaseError] = useState('');
  const [latestDatabaseVersion, setLatestDatabaseVersion] = useState(null);

  // Google Drive
  const [usingGoogleDrive, setUsingGoogleDrive] = useState(false);
  const [credentialsFile, setCredentialsFile] = useState<string>("");
  const [credentials, setCredentials] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [clientID, setClientID] = useState('');
  const [clientTemp, setClientTemp] = useState('');
  const [secret, setSecret] = useState('');
  const [secretTemp, setSecretTemp] = useState('');
  const [lockFileExists, setLockFileExists] = useState(false);

  const Accordion = styled((props: AccordionProps) => (
    <MuiAccordion disableGutters elevation={0} square {...props} />
  ))(({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    '&:not(:last-child)': {
      borderBottom: 0,
    },
    '&::before': {
      display: 'none',
    },
  }));

  const AccordionSummary = styled((props: AccordionSummaryProps) => (
    <MuiAccordionSummary
      {...props}
    />
  ))(({ theme }) => ({
    backgroundColor: 'rgba(0, 0, 0, .03)',
    ...theme.applyStyles('dark', {
      backgroundColor: 'rgba(255, 255, 255, .05)',
    }),
  }));
  
  const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
    padding: theme.spacing(2),
    borderTop: '1px solid rgba(0, 0, 0, .125)',
  }));

  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false);
      if (newExpanded) {
        setSelectedValue(panel);
      }
  };
  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedValue(event.target.value);
  };

  const check_database_file = (my_databaseFile) => {
    //console.log("Checking DB file: ", my_databaseFile);
    if (my_databaseFile?.length) {
      setDatabaseExists(false);
      setDatabaseVersion(null);

      // Check if the database exists
      const ipcRenderer = (window as any).ipcRenderer;
      const fs = ipcRenderer.require('fs')

      if (fs.existsSync(my_databaseFile)) {
        //console.log("file exists");
        setDatabaseFile(my_databaseFile);
        setDatabaseExists(true);

        // Save this in local storage
        localStorage.setItem('databaseFile', JSON.stringify(my_databaseFile));
        const ipcRenderer = (window as any).ipcRenderer;
        ipcRenderer.send(channels.SET_DB_PATH, { DBPath: my_databaseFile });

        // Receive the data
        ipcRenderer.on(channels.DONE_SET_DB_PATH, () => {
          get_db_version();

          ipcRenderer.removeAllListeners(channels.DONE_SET_DB_PATH);
        });

        // Clean the listener after the component is dismounted
        return () => {
          ipcRenderer.removeAllListeners(channels.DONE_SET_DB_PATH);
        };
      }
    }
  };

  const get_db_version = () => {
    // Signal we want to get data
    const ipcRenderer = (window as any).ipcRenderer;
    ipcRenderer.send(channels.GET_DB_VER);

    // Receive the data
    ipcRenderer.on(channels.LIST_DB_VER, ({ version, latest }) => {
      setDatabaseVersion(version);
      setLatestDatabaseVersion(latest);
      
      ipcRenderer.removeAllListeners(channels.LIST_DB_VER);
    });

    // Clean the listener after the component is dismounted
    return () => {
      ipcRenderer.removeAllListeners(channels.LIST_DB_VER);
    };
  };

  const handleUpdateDB = () => {
    // Signal we want to get data
    const ipcRenderer = (window as any).ipcRenderer;
    ipcRenderer.send(channels.UPDATE_DB);

    // Receive the data
    ipcRenderer.on(channels.DONE_UPDATE_DB, () => {
      get_db_version();

      ipcRenderer.removeAllListeners(channels.DONE_UPDATE_DB);
    });

    // Clean the listener after the component is dismounted
    return () => {
      ipcRenderer.removeAllListeners(channels.DONE_UPDATE_DB);
    };
  };

  const handleUseDrive = async (useDrive) => {

    localStorage.setItem(
      'use-Google-Drive',
      JSON.stringify({ useGDrive: useDrive })
    );
    setUsingGoogleDrive(useDrive);
    if (useDrive) {
      // Setup everything.
      if (credentials) {
        if (!client) {
          handleAuthClick();
        } else {
          handleGetFile();
        }
      }
    } else {
      // Communicate this down to the main thread
      // so it doesn't try and upload upon close.
      const ipcRenderer = (window as any).ipcRenderer;
      ipcRenderer.send(channels.DRIVE_STOP_USING);

      localStorage.setItem('databaseFile', JSON.stringify(''));
      localStorage.setItem('drive-file', JSON.stringify(''));
      setDatabaseFile('');
    }
  }

  const handlePushFile = async () => {
    if (client) {
      const ipcRenderer = (window as any).ipcRenderer;
      ipcRenderer.send(channels.DRIVE_PUSH_FILE);

      // Receive the data
      ipcRenderer.on(channels.DRIVE_DONE_PUSH_FILE, () => {
        //console.log("Done pushing the file");

        ipcRenderer.removeAllListeners(channels.DRIVE_DONE_PUSH_FILE);
      });

      // Clean the listener after the component is dismounted
      return () => {
        ipcRenderer.removeAllListeners(channels.DRIVE_DONE_PUSH_FILE);
      };
    } else {
      //console.log("Don't have client");
    }
  };

  const handleDeleteLock = async () => {
    if (client) {
      const ipcRenderer = (window as any).ipcRenderer;
      ipcRenderer.send(channels.DRIVE_DELETE_LOCK, { credentials: credentials, tokens: client });
      setLockFileExists(false);
      setDatabaseError('');
      localStorage.setItem('LockFileExists', JSON.stringify(false));
      
      // Receive the data
      ipcRenderer.on(channels.DRIVE_DONE_DELETE_LOCK, () => {
        // Since we were deleting the keys, we likely want to get the database
        handleGetFile();

        ipcRenderer.removeAllListeners(channels.DRIVE_DONE_DELETE_LOCK);
      });

      // Clean the listener after the component is dismounted
      return () => {
        ipcRenderer.removeAllListeners(channels.DRIVE_DONE_DELETE_LOCK);
      };
    } else {
      //console.log("Don't have client");
    }
  };

  const handleGetFile = async () => {
    if (client) {
      setLockFileExists(false);
      setDatabaseError('');
      localStorage.setItem('LockFileExists', JSON.stringify(false));
      const ipcRenderer = (window as any).ipcRenderer;
      ipcRenderer.send(channels.DRIVE_GET_FILE, { credentials: credentials, tokens: client });

      // Receive the data
      ipcRenderer.on(channels.DRIVE_DONE_GET_FILE, ({ fileName, error }) => {
        //let removeListeners = true;
        if (fileName) {

          localStorage.setItem('databaseFile', JSON.stringify(fileName));
          setDatabaseFile(fileName);


          //console.log("We got the file: ", fileName);
          check_database_file(fileName);
        }
        if (error) {
          //console.log("Error getting the file: " + error);
          if (error.startsWith('Lock file already exists')) {
            setLockFileExists(true);
            setDatabaseError(
              'Looks like someone is using the database on Google Drive,\n' +
              'delete the lock files and try downloading the database again.'
            );
            localStorage.setItem('LockFileExists', JSON.stringify(false));
          } else {
            setDatabaseError(error);
          }
          //if (error.startsWith('Another thread is trying to get the DB file')) {
          //  removeListeners = false;
          //}
        }

        //if (removeListeners) {
        ipcRenderer.removeAllListeners(channels.DRIVE_DONE_GET_FILE);
        //}
      });

      // Clean the listener after the component is dismounted
      return () => {
        ipcRenderer.removeAllListeners(channels.DRIVE_DONE_GET_FILE);
      };
    }
  };

  const handleAuthClick = async () => {
    if (!credentials) {
      console.log('Please upload the credentials file.');
      return;
    }

    const ipcRenderer = (window as any).ipcRenderer;
    ipcRenderer.send(channels.DRIVE_AUTH, {
      privateCreds: { clientEmail: clientID, privateKey: secret },
      credentials: credentials
    });

    // Receive the data
    ipcRenderer.on(channels.DRIVE_DONE_AUTH, ({ return_creds }) => {
      //console.log(return_creds);
      setClient(return_creds);
      localStorage.setItem('drive-client', JSON.stringify({ client: return_creds }));

      //handleListFiles();
      ipcRenderer.removeAllListeners(channels.DRIVE_DONE_AUTH);
    });

    // Clean the listener after the component is dismounted
    return () => {
      ipcRenderer.removeAllListeners(channels.DRIVE_DONE_AUTH);
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setCredentialsFile(file.path);
    }
  };

  const handleClientChange = () => {
    //console.log("setting client to: ", clientTemp);
    setClientID(clientTemp);
    localStorage.setItem('drive-info', JSON.stringify({ clientID: clientTemp, secret: secret, creds: credentials }));
    setClient(null);
    localStorage.setItem('drive-client', JSON.stringify({}));
  };
  const handleSecretChange = () => {
    //console.log("setting secret to: ", secretTemp);
    setSecret(secretTemp);
    localStorage.setItem('drive-info', JSON.stringify({ clientID: clientID, secret: secretTemp, creds: credentials }));
    setClient(null);
    localStorage.setItem('drive-client', JSON.stringify({}));
  };

  const readCredentialsFile = () => {
    const ipcRenderer = (window as any).ipcRenderer;
    const fs = ipcRenderer.require('fs')
    fs.readFile(credentialsFile, 'utf8', (err, data) => {
      if (err) throw err;

      const tmpCreds = JSON.parse(data.trim());
      setCredentials(tmpCreds);
      setClient(null);
      localStorage.setItem('drive-client', JSON.stringify({}));

      localStorage.setItem('drive-info', JSON.stringify({ clientID: clientID, secret: secret, creds: tmpCreds }));
    });
  }

  useEffect(() => {
    if (credentialsFile) {
      readCredentialsFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialsFile]);

  useEffect(() => {
    const databaseFile_str = localStorage.getItem('databaseFile');
    if (databaseFile_str?.length) {
      const my_databaseFile = JSON.parse(databaseFile_str);
      if (my_databaseFile) {
        // Check if the database exists
        const ipcRenderer = (window as any).ipcRenderer;
        const fs = ipcRenderer.require('fs')

        if (fs.existsSync(my_databaseFile)) {
          setDatabaseFile(my_databaseFile);
          setDatabaseExists(true);
          get_db_version();
        }
      }
    }

    const drive_info_str = localStorage.getItem('drive-info');
    if (drive_info_str?.length) {
      const drive_info = JSON.parse(drive_info_str);
      if (drive_info) {
        setClientID(drive_info.clientID);
        setSecret(drive_info.secret);
        setCredentials(drive_info.creds);
      }
    }

    const drive_client_str = localStorage.getItem('drive-client');
    if (drive_client_str?.length) {
      const drive_client = JSON.parse(drive_client_str);
      if (drive_client) {
        setClient(drive_client.client);
      }
    }

    const using_Drive_str = localStorage.getItem('use-Google-Drive');
    if (using_Drive_str?.length) {
      const using_Drive = JSON.parse(using_Drive_str);
      if (using_Drive) {
        setUsingGoogleDrive(using_Drive.useGDrive);
      }
    }

    const lock_str = localStorage.getItem('LockFileExists');
    if (lock_str?.length) {
      const lock_exists = JSON.parse(lock_str);
      if (lock_exists) {
        setLockFileExists(true);
        setDatabaseError(
          'Looks like someone is using the database on Google Drive,\n' +
          'delete the lock files and try downloading the database again.'
        );
      }
    }

    const DB_err_str = localStorage.getItem('DatabaseError');
    if (DB_err_str?.length) {
      const DB_err = JSON.parse(DB_err_str);
      if (DB_err) {
        setDatabaseError(DB_err);
      }
    }

  }, []);

  return (
    <>
      <table className="Table" cellSpacing={0} cellPadding={0}>
        <tbody>
          {databaseFile &&
            <tr className="TR">
              <td className="Table TC Right">Database:</td>
              <td className="Table TC Left">{databaseFile}</td>
            </tr>
          }
          {databaseFile && !databaseExists &&
            <tr className="TR">
              <td className="Table TC Right">Status:</td>
              <td className="Table TC Left">The database file does not exist.</td>
            </tr>
          }
          {databaseFile && databaseExists && !databaseVersion &&
            <tr className="TR">
              <td className="Table TC Right">Status:</td>
              <td className="Table TC Left">{databaseError}</td>
            </tr>
          }
          {databaseFile && databaseExists && databaseVersion &&
            <tr className="TR">
              <td className="Table TC Right">Status:</td>
              <td className="Table TC Left">Database version: {databaseVersion}</td>
            </tr>
          }
        </tbody>
      </table>
      {databaseFile && databaseExists && databaseVersion && (databaseVersion !== latestDatabaseVersion) &&
        <>
          <br />
          <button onClick={handleUpdateDB} className="textButton GDrive">Update DB to ver {latestDatabaseVersion}</button>
        </>
      }
      {databaseFile && <><br /><br /></>}
      <>
        <FormControl>
        <RadioGroup
          aria-labelledby="demo-radio-buttons-group-label"
          defaultValue="cloud"
          name="radio-buttons-group"
        >
          <Accordion disabled expanded={expanded === 'local'} onChange={handleChange('local')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="local-content"
              id="local-header"
            >
              <FormControlLabel value="local" control={
                <Radio 
                  checked={selectedValue === 'local'}
                  onChange={handleRadioChange}
                  value="local"
                />
                } label="Local SQLite DB" />
            </AccordionSummary>
            <AccordionDetails>
              <div style={{ textAlign: 'left' }}>
              You can store the SQLite database locally.<br/>
              It will be tricky to share your budget with 
              anyone else, but you will control all your data.<br/>
              You can select an existing database or create a new one.
              </div><br/>
            <table className="Table" cellSpacing={0} cellPadding={0} style={{ border: '0', borderCollapse: 'collapse' }}><tbody>
            <tr className="TR">
              <td className="Table TC Right" style={{ border: '0' }}>
                {!databaseFile &&
                  <span>Select local database file:</span>
                }
                {databaseFile &&
                  <span>Select a different local database file:</span>
                }
              </td>
              <td className="Table TC Left" style={{ border: '0' }}>
                <input
                  type="file"
                  name="file"
                  className="import-file"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleUseDrive(false);
                      check_database_file(e.target.files[0].path);
                    }
                  }}
                />
              </td>
            </tr>
            <tr className="TR">
              <td className="Table TC Right" style={{ border: '0' }}>
                <span>Create a new local database file:</span>
              </td>
              <td className="Table TC Left" style={{ border: '0' }}>
                <button
                  className="textButton GDrive"
                  style={{ height: 'minHeight', paddingTop: '0px', paddingBottom: '0px', minHeight: '' }}
                  onClick={() => {
                    const ipcRenderer = (window as any).ipcRenderer;
                    ipcRenderer.send(channels.CREATE_DB);

                    // Receive the new filename
                    ipcRenderer.on(channels.LIST_NEW_DB_FILENAME, (arg) => {
                      if (arg?.length > 0) {
                        handleUseDrive(false);
                        check_database_file(arg);
                      }

                      ipcRenderer.removeAllListeners(channels.LIST_NEW_DB_FILENAME);
                    });

                    // Clean the listener after the component is dismounted
                    return () => {
                      ipcRenderer.removeAllListeners(channels.LIST_NEW_DB_FILENAME);
                    };
                  }}>
                  Create New
                </button>
              </td>
            </tr>
            </tbody></table>
            </AccordionDetails>
          </Accordion>
          <Accordion disabled expanded={expanded === 'drive'} onChange={handleChange('drive')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="drive-content"
              id="drive-header"
            >
              <FormControlLabel value="drive" control={
                <Radio 
                  checked={selectedValue === 'drive'}
                  onChange={handleRadioChange}
                  value="drive"
                />
                } label="SQLite DB on Google Drive" />
            </AccordionSummary>
            <AccordionDetails>
              <div style={{ textAlign: 'left' }}>
                To use Google Drive, you should have 
                a Google API project setup.<br />
                You can go to '<a href='https://console.cloud.google.com'>Google Cloud Console</a>' in order to set this up.<br />
                The return URL in the JSON 
                should be set to: http://127.0.0.1:3001<br/>
                The database will be a SQLite database called SavvyBudget.db.<br/>
                It will get copied from your Google Drive root folder when starting,<br/>
                and copied back to your Google Drive root folder when you close the app.
              </div><br/>
            
                {!credentials &&
                  <div style={{ textAlign: 'left' }}>
                    Start by loading your Google Drive client secret json file:<br />
                    <input type="file" accept=".json" onChange={handleFileChange} />
                  </div>
                }
                {credentials &&
                  <>
                    <table><tbody>
                      <tr>
                        <td className="txFilterLabelCell">
                          Client Email:
                        </td>
                        <td className="txFilterCell">
                          <input
                            name="DRIVEClient"
                            defaultValue={clientID}
                            onChange={(e) => setClientTemp(e.target.value)}
                            onBlur={handleClientChange}
                            className="filterSize"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="txFilterLabelCell">
                          Secret:
                        </td>
                        <td className="txFilterCell">
                          <input
                            name="DRIVESecret"
                            defaultValue={secret}
                            onChange={(e) => setSecretTemp(e.target.value)}
                            onBlur={handleSecretChange}
                            className="filterSize"
                          />
                        </td>
                      </tr>
                    </tbody></table>
                    {(!client || databaseError.startsWith('Token has been expired')) && 
                      <>
                        <br />
                        <button onClick={handleAuthClick} className="textButton GDrive">Authorize Google Drive</button>
                      </>
                    }
                    {client &&
                      <>
                        <br />
                        <button onClick={handleGetFile} className="textButton GDrive">Get DB from Google Drive</button>
                      </>
                    }
                    {client && lockFileExists &&
                      <>
                        <br />
                        Lock files found, someone may be using the database. <br />
                        If you are confident no one is using the database, <br />
                        delete the lock files with the button below and <br />
                        try getting the database again.<br />
                        <button onClick={handleDeleteLock} className="textButton GDrive">Delete Lock File</button>
                      </>
                    }
                    {client && databaseFile && databaseVersion &&
                      <>
                        <br />
                        <button onClick={handlePushFile} className="textButton GDrive">Upload DB back to Google Drive</button>
                      </>
                    }
                  </>
                }
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'cloud'} onChange={handleChange('cloud')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="cloud-content"
              id="cloud-header"
            >
              <FormControlLabel value="cloud" control={
                <Radio 
                  checked={selectedValue === 'cloud'}
                  onChange={handleRadioChange}
                  value="cloud"
                />
                } label="Cloud hosted DB" />
            </AccordionSummary>
            <AccordionDetails>
              <div style={{ textAlign: 'left' }}>
                We can host the data for you in a cloud-based DB.
              </div>
            </AccordionDetails>
          </Accordion>
          </RadioGroup>
        </FormControl>
      </>
    </>
  );
};


export default ConfigDB;