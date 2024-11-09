import React from 'react';
import { Box, LinearProgress, styled } from '@mui/material';

interface ProgressBarProps {
  actual: number;
  target: number;
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

const ProgressBar: React.FC<ProgressBarProps> = ({ actual, target, overColor }) => {
  const primaryValue = Math.min((actual / target) * 100, 100);
  
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
        {actual > target && (
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
      </Box>
    </Box>
  );
};

export default ProgressBar;
