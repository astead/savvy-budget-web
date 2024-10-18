import React, { useEffect, useState } from 'react';
import 'react-edit-text/dist/index.css';

export const InputText = ({ in_ID, in_value, callback, err_callback, className, style, isNum}) => {
  const [id, ] = useState(in_ID);
  const [value, setValue] = useState(in_value);
  const [isErr, setIsErr] = useState(false);

  const handleChange = (e, setFn) => {
    setIsErr(false);
    setFn(e.target.value);
  };

  const handleBlur = () => {
    if (isNum) {
      // Special handling if this is supposed to be a number
      if (!value) {
        // If we have a null value, set it to 0
        setValue(0);
        callback(id, 0);
      } else {
        // Otherwise check if it is a number
        // if not, set we have an error
        if (isNaN(value)) {
          setIsErr(true);
        } else {
          // Otherwise send the callback
          setIsErr(false);
          callback(id, value);
        }
      }
    } else {
      callback(id, value);
    }
  };

  useEffect(() => {
    if (err_callback) {
      err_callback(isErr);
    }
  }, [isErr, err_callback]);
  
  useEffect(() => {
    setValue(in_value);
  }, [in_value]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => handleChange(e, setValue)}
      onBlur={handleBlur}
      className={ className + (isErr ? ' Red' : '')}
      style={style}
     />
  );
};

export default InputText;