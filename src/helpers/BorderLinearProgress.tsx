import React from 'react';
import { Box, LinearProgress, styled, Typography } from '@mui/material';

interface ProgressBarProps {
  actual: number;
  target: number;
  balance: number;
  overColor: string;
}

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: '5px 5px 5px 5px',
  '& .MuiLinearProgress-bar': {
    borderRadius: '5px 5px 5px 5px',
  },
}));

const BorderLinearProgressNoRightRadius = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: '5px 0 0 5px',
  '& .MuiLinearProgress-bar': {
    borderRadius: '5px 0 0 5px',
  },
}));

const BorderLinearProgressNoLeftRadius = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: '0 5px 5px 0',
  '& .MuiLinearProgress-bar': {
    borderRadius: '0 5px 5px 0',
  },
}));

function formatWholeCurrency(currencyNumber:number) {
  return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};


const ProgressBar: React.FC<ProgressBarProps> = ({ actual, target, balance, overColor }) => {
  let primaryValue = Math.min((actual / target) * 100, 100);
  if (actual === 0 && target === 0) {
    primaryValue = 0;
  }
  
  return (
    <Box position="relative" display="flex" alignItems="center" width="100%">
      <Box width="100%" mr={1} position="relative">
        {actual <= target && (
          <BorderLinearProgress
            variant="determinate"
            value={primaryValue}
            sx={{ 
              width: `${ actual > target ? ( 100 * (target / actual) ) : 100 }%`,
            }}
          />
        )}
        {target !== 0 && actual > target && (
          <>
            <BorderLinearProgressNoRightRadius
              variant="determinate"
              value={primaryValue}
              sx={{ 
                width: `${ actual > target ? ( 100 * (target / actual) ) : 100 }%`,
              }}
            />
            <BorderLinearProgressNoLeftRadius
              variant="determinate"
              value={100}
              sx={{
                position: 'absolute',
                top: 0,
                left: `${100 * (target / actual)}%`,
                width: `${100 - ( 100 * (target / actual) )}%`,
                '& .MuiLinearProgress-bar': { backgroundColor: overColor },
              }}
            />
          </>
        )}
        {target === 0 && actual > target && (
          <>
            <BorderLinearProgress
              variant="determinate"
              value={100}
              sx={{
                width: `${100 - ( 100 * (target / actual) )}%`,
                '& .MuiLinearProgress-bar': { backgroundColor: overColor },
              }}
            />
          </>
        )}
        <Typography variant="body2" sx={{ position: 'absolute', top: '50%', right: '0', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 'bold', color: 'black' }} > Balance: {formatWholeCurrency(balance)} </Typography>
      </Box>
      
    </Box>
  );
};

export default ProgressBar;
