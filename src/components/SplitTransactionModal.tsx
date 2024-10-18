import React, { useEffect, useState } from 'react';
import { Button, Box, Modal } from '@mui/material';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareNodes, faPlus, faMinus } from "@fortawesome/free-solid-svg-icons";
import * as dayjs from 'dayjs'
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import { InputText } from '../helpers/InputText.tsx';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
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

interface SplitNode {
  txDate: number;
  txAmt: number;
  txDesc: string;
  txEnvID: number; 
}

function formatCurrency(currencyNumber:number) {
  if (currencyNumber === null) {
    // TODO: why are we getting a null value?
    console.log("WARNING: we were asked to convert a null number to a currency string.");
    let tmpNumber = 0;
    return tmpNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
  }
  return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
};

export const SplitTransactionModal = ({txID, txDate, txAmt, txDesc, cat, env, envID, isSplit, envList, callback}) => {
  const { config } = useAuthToken();

  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const [splitData, setSplitData] = useState<SplitNode[]>([]);
  const [error, setError] = useState("");
  const [initialLoad, setInitialLoad] = useState(false);

  const handleSaveNewValue = async () => {
    // Request we update the DB
    if (splitData.reduce((a, item) => a + item.txAmt, 0).toFixed(2) === txAmt.toFixed(2)) {

      if (!config) return;
      await axios.post(baseUrl + channels.SPLIT_TX, { txID: txID, split_tx_list: splitData }, config);
      
      setOpen(false);
      callback();

    } else {
      setError("Total split value of " +
        formatCurrency(splitData.reduce((a, item) => a + item.txAmt, 0)) +
        " does not match original transaction amount of " +
        formatCurrency(txAmt));
    }
  };

  const handleTxEnvIDChange = ({id, new_value}) => {
    let tmpArr = splitData;
    tmpArr[id].txEnvID = new_value;
    setSplitData([...tmpArr]);
  };

  const handleTxDateChange = (index, newValue) => {
    let tmpArr = splitData;
    tmpArr[index].txDate = newValue.format('YYYY-MM-DD');
    setSplitData([...tmpArr]);
  }

  const handleTxDescChange = (id, value) => {
    let tmpArr = splitData;
    tmpArr[id].txDesc = value;
    setSplitData([...tmpArr]);
  }

  const handleTxAmtChange = (id, value) => {
    let tmpArr = splitData;
    tmpArr[id].txAmt = parseFloat(value);
    setSplitData([...tmpArr]);
  }

  const handleErrValue = (isErr) => {
    if (isErr) {
      setError("Please enter a valid number.");
    }
  }
  
  const addNewSplit = (count) => {
    const numSplit = splitData?.length;
    const newNumSplit = numSplit + count;
    let defValue = txAmt.toFixed(2);
    let oldDefValue = txAmt.toFixed(2);

    if (numSplit) {
      oldDefValue = (txAmt / numSplit);
      oldDefValue = Math.round(oldDefValue * 100) / 100;
    }

    if (newNumSplit) {
      defValue = (txAmt / newNumSplit);
      defValue = Math.round(defValue * 100) / 100;
    }

    let tmpArr = [...splitData];
      
    if (numSplit > 0 && tmpArr[0].txAmt === oldDefValue) {
      tmpArr.map((item) => {
        item.txAmt = defValue;
        return item;
      })
    }  

    let cur_sum = tmpArr.reduce((a, item) => a + item.txAmt, 0);

    for (let i = 0; i < count; i++) {
      let amtValue = defValue;
      if (i === count-1) {
        amtValue = txAmt - cur_sum;
        amtValue = Math.round(amtValue * 100) / 100;
      } else {
        cur_sum += defValue;
      }

      const newNode = {
        txDate: txDate,
        txAmt: amtValue as number,
        txDesc: txDesc,
        txEnvID: envID
      }

      tmpArr = [...tmpArr, newNode];
    }

    setSplitData([...tmpArr]);
    setError("");
  }

  function removeSplit(index)  {
    let tmpArr = splitData;
    tmpArr.splice(index, 1);
    setSplitData([...tmpArr]);
    setError("");
  }  

  function checkTotals() {
    // Request we update the DB
    if (splitData.reduce((a, item) => a + item.txAmt, 0).toFixed(2) !== txAmt.toFixed(2)) {
      setError("Total split value of " +
        formatCurrency(splitData.reduce((a, item) => a + item.txAmt, 0)) +
        " does not match original transaction amount of " +
        formatCurrency(txAmt));
    } else {
      setError("");
    }
  }

  useEffect(() => {
    checkTotals();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitData]); 

  useEffect(() => {
    checkTotals();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); 

  useEffect(() => {
    if (initialLoad) {
      addNewSplit(2);
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoad]); 

  useEffect(() => {
    setInitialLoad(true);
    checkTotals();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <>
      <span onClick={handleOpen}
        className={"Toggle" + (isSplit ?" Toggle-active":"")}>
          <FontAwesomeIcon icon={faShareNodes} />
      </span>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          Let's split this transaction!<br/>
          
          <table className="Table TxTable" cellSpacing={0} cellPadding={0} width="800">
            <thead>
              <tr className="Table THR">
                <th className="Table THR THRC Small">Date</th>
                <th className="Table THR THRC">Description</th>
                <th className="Table THR THRC">Envelope</th>
                <th className="Table THR THRC Small">Amount</th>
                <th className="Table THR THRC Smallest">{'  '}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="Table THR">
                <td className="Table TC Right">{dayjs(txDate).format('M/D/YYYY')}</td>
                <td className="Table TC Left">{txDesc}</td>
                <td className="Table TC Left">{cat + " : " + env}</td>
                <td className="Table TC Right">{formatCurrency(txAmt)}</td>
                <td className="Table TC Smallest">
                  <button 
                    onClick={() => addNewSplit(1)}>
                      <FontAwesomeIcon icon={faPlus} />
                  </button>
                </td>
              </tr>
              {splitData.map((item, index) => (
                <tr key={index}>
                  <td className="Table TC Right">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      value={dayjs(item.txDate)}
                      onChange={(newValue) => handleTxDateChange(index, newValue)}
                      sx={{ width:150, pr:0 }}
                      />
                    </LocalizationProvider>
                  </td>
                  <td className="Table TC Left">
                    <InputText
                      in_ID={index}
                      in_value={item.txDesc}
                      callback={handleTxDescChange}
                      err_callback={null}
                      className="Medium"
                      style={{}}
                      isNum={false}
                    />
                  </td>
                  <td className="Table TC Left">
                    <DropDown 
                      id={index}
                      selectedID={item.txEnvID}
                      optionData={envList}
                      changeCallback={handleTxEnvIDChange}
                      className="selectField"
                      />
                  </td>
                  <td className="Table TC Right">
                    <InputText
                      in_ID={index}
                      in_value={item.txAmt.toFixed(2)}
                      callback={handleTxAmtChange}
                      err_callback={handleErrValue}
                      className="Small Right"
                      style={{ paddingRight:'1px' }}
                      isNum={true}
                    />
                  </td>
                  <td className="Table TC Smallest">
                    <button 
                      onClick={() => removeSplit(index) }>
                        <FontAwesomeIcon icon={faMinus} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="Table THR">
                <td className="Table TC Right"></td>
                <td className="Table TC Left"></td>
                <td className="Table TC Right"> Split total:</td>
                <td className="Table TC Right">
                  <span className={ 
                    ( // TODO: For some reason some of these reduce functions are returning null
                      splitData.reduce((a, item) => a + item.txAmt, 0) && 
                      splitData.reduce((a, item) => a + item.txAmt, 0).toFixed(2) !== txAmt.toFixed(2)
                    ) ? " Red" : "" }>
                    { formatCurrency(splitData.reduce((a, item) => a + item.txAmt, 0)) }
                  </span>
                </td>
                <td className="Table TC Smallest"></td>
              </tr>
            </tbody>
          </table>
          <Button variant="contained" className='textButton'
            onClick={handleSaveNewValue} disabled={error.length > 0}>
              All Done, Split it!
          </Button>
          <br/>
          {error?.length > 0 &&
            <span className="Red">
              {error}
              <br/>
            </span>
          }
        </Box>
      </Modal>
    </>
  );
};

export default SplitTransactionModal;
