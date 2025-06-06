import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

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

function formatCurrency(currencyNumber:number) {
  return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
};

export const BudgetBalanceModal = ({
    balanceAmt, category, envelope, envID, 
    transferEnvList, callback_transfer, callback_change }) => {

  const { config } = useAuthToken();

  const [open, setOpen] = useState(false);
  const [newAmt, setNewAmt] = useState(balanceAmt.toFixed(2));
  const [transferAmt, setTransferAmt] = useState(balanceAmt.toFixed(2));
  const [transferEnvID, setTransferEnvID] = useState(envID);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSaveNewValue = async () => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.UPDATE_BALANCE, { id: envID, newAmt: newAmt }, config);
    setOpen(false);
    callback_change({ newAmt: newAmt });
  };

  const handleSaveTransfer = async () => {
    // Request we update the DB
    
    if (!config) return;
    await axios.post(baseUrl + channels.MOVE_BALANCE, { transferAmt: transferAmt, fromID: envID, toID: transferEnvID }, config);
    setOpen(false);
    callback_transfer({ transferAmt: transferAmt, toID: transferEnvID });
  };

  const handleFilterEnvChange = ({id, new_value, new_text}) => {
    setTransferEnvID(new_value);
  };

  return (
    <>
      <span onClick={handleOpen} className="clickable" style={{paddingRight: '2px', paddingLeft: '2px'}}>{formatCurrency(balanceAmt)}</span>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          What do you want to do with balance from:<br/>
          {category} : {envelope}?<br/><br/>
          Adjust it: 
          <input
            name={'adjust-balance-'+envID}
            defaultValue={balanceAmt.toFixed(2)}
            onChange={(e) => setNewAmt(e.target.value)}
            className="Curr BalTransfer"
          />
          <button 
            onClick={handleSaveNewValue}>
              <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <br/>
          <br/>
          Move 
          <input
            name={'adjust-balance-' + envID}
            defaultValue={balanceAmt.toFixed(2)}
            onChange={(e) => setTransferAmt(e.target.value)}
            className="Curr BalTransfer"
          />
          to&nbsp;
          <DropDown 
            id={'transfer-from-' + envID}
            selectedID={envID}
            optionData={transferEnvList}
            changeCallback={handleFilterEnvChange}
            className=""
          />
          <button 
            onClick={handleSaveTransfer}>
              <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <br/>
        </Box>
      </Modal>
    </>
  );
};

export default BudgetBalanceModal;
