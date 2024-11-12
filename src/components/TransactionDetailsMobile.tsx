import React from 'react';
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
  
  const handleChangeEnvID = async ({id, new_value, new_text}) => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.UPDATE_TX_ENV, { txID: id, envID: new_value }, config);
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
        <p>{dayjs(transaction.txDate).format('MMMM D, YYYY')}</p>
        <p>{transaction.common_name}</p>
        <p>{transaction.description}</p>
        <p>{formatCurrency(transaction.txAmt)}</p>
        <p>
          <DropDown
            id={transaction.txID}
            selectedID={transaction.envID}
            optionData={envList}
            changeCallback={handleChangeEnvID}
            className="selectField"
          />
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionDetailsMobile;
