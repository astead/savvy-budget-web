import React, { useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import * as dayjs from 'dayjs';
import { DropDown } from '../helpers/DropDown.tsx';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { KeywordSave } from '../helpers/KeywordSave.tsx';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<unknown>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function formatCurrency(currencyNumber:number) {
  if (currencyNumber === null) {
    // TODO: why are we getting a null value?
    console.log("WARNING: we were asked to convert a null number to a currency string.");
    let tmpNumber = 0;
    return tmpNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
  }
  return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
}

const TransactionDetailsMobile = ({ open, handleClose, transaction, envList, callback }) => {
  const { config } = useAuthToken();

  const [my_tx, setMy_tx] = useState(transaction);
  
  const handleDelete = async () => {
    // Signal we want to del data
    if (!config) return;
    transaction.isChecked = true;
    await axios.post(baseUrl + channels.DEL_TX_LIST, { del_tx_list: [my_tx] }, config);
    
    callback();
    handleClose();
  }

  const handleChangeEnvID = async ({id, new_value, new_text}) => {
    // Request we update the DB
    if (!config) return;
    
    setMy_tx({ ...my_tx, envID: new_value });
    await axios.post(baseUrl + channels.UPDATE_TX_ENV, { txID: id, envID: new_value }, config);
    
    callback();
  };

  const toggleDuplicate = async ({txID, isDuplicate}) => {
    // Request we update the DB
    if (!config) return;
    
    setMy_tx({ ...my_tx, isDuplicate: isDuplicate });
    await axios.post(baseUrl + channels.SET_DUPLICATE, { txID: txID, isDuplicate: isDuplicate }, config);
    
    callback();
  };

  const toggleVisibility = async ({txID, isVisible}) => {
    // Request we update the DB
    if (!config) return;
    setMy_tx({ ...my_tx, isVisible: isVisible });
    await axios.post(baseUrl + channels.SET_VISIBILITY, { txID: txID, isVisible: isVisible }, config);
    
    callback();
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={handleClose}
      TransitionComponent={Transition}
    >
      <DialogTitle>Transaction Details</DialogTitle>
      <DialogContent>
        <div><b>Date:</b> {dayjs(my_tx.txDate).format('MMMM D, YYYY')}</div>
        <div><b>Bank:</b> {my_tx.common_name}</div>
        <div><b>Desc:</b> {my_tx.description}</div>
        <div><b>Amount:</b> {formatCurrency(my_tx.txAmt)}</div>
        <div><b>Category:</b><br/>
          <DropDown
            id={my_tx.txID}
            selectedID={my_tx.envID}
            optionData={envList}
            changeCallback={handleChangeEnvID}
            className="selectField"
          />
        </div>
        <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'row' }}>
          <div style={{ paddingRight: '10px' }}><b>Save keyword:</b></div>
          <KeywordSave
            txID={my_tx.txID}
            acc={my_tx.common_name}
            envID={my_tx.envID}
            description={my_tx.description}
            keywordEnvID={my_tx.keywordEnvID}
            callback={callback}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ paddingRight: '10px' }}><b>Is duplicate:</b></div>
          <div
            onClick={() => {
              toggleDuplicate({txID: my_tx.txID, isDuplicate: (my_tx.isDuplicate === 1 ? 0 : 1)});
            }}
            className={my_tx.isDuplicate ? 'ToggleMobile-active' : 'ToggleMobile'}>
            <FontAwesomeIcon icon={faCopy} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ paddingRight: '10px' }}><b>Is visible:</b></div>
          <div
            onClick={() => {
              toggleVisibility({txID: my_tx.txID, isVisible: ( my_tx.isVisible ? false : true)});
            }}
            className={my_tx.isVisible ? 'ToggleMobile' : 'ToggleMobile-active'}>
            <FontAwesomeIcon icon={my_tx.isVisible ? faEye : faEyeSlash} />
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '10px'
        }}>
          <Button
            variant="contained"
            className='textButton'
            style={{ backgroundColor: 'Salmon' }}
            onClick={handleDelete}
          >
            Delete
          </Button>
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionDetailsMobile;
