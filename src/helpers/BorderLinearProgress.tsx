import React from 'react';
import { Box, LinearProgress, styled, Typography } from '@mui/material';

interface ProgressBarProps {
  actual: number;
  budget: number;
  balance: number;
  overColor: string;
}

function formatWholeCurrency(currencyNumber:number) {
  return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};


const ProgressBar: React.FC<ProgressBarProps> = ({ actual, budget, balance, overColor }) => {
  const prevBalance = balance + actual - budget;
  
  const totalSaved = 
    (budget > 0 ? budget : 0) + 
    (actual < 0 ? (-1 * actual) : 0) + 
    (prevBalance > 0 ? prevBalance : 0);

  const totalSpent = 
    (actual > 0 ? actual : 0) +
    (budget < 0 ? (-1 * budget) : 0) + 
    (prevBalance < 0 ? -1 * prevBalance : 0);

  const maxTotal = Math.max(totalSaved, totalSpent);
  
  const budgetPercentage = (budget === 0) ? 0 : (budget / maxTotal) * 100;
  const actualPercentage = (actual === 0) ? 0 : (actual / maxTotal) * 100;

  const savedBalancePercentage = (prevBalance > 0) ? (prevBalance / maxTotal) * 100 : 0;
  const spentBalancePercentage = (prevBalance < 0) ? (-1 * prevBalance / maxTotal) * 100 : 0;
  
 
  return (
    <Box width="100%" display="flex" flexDirection="column" alignItems="center"  position="relative">

      { /* SAVED progress bar */ }
      <Box width="100%" mb={1} display="flex" height="20px"
        sx={{
          position: 'relative',
          zIndex: '1',
        }}>
        { /* Current month's budget */ }
        <Box
          sx={{
            backgroundColor: "#85C1E9", //Light Blue, previously: "#27AE60", // Medium Green
            width: `${ budgetPercentage }%`,
          }}
        />
        { /* Previously saved based on balance */ }
        <Box
          sx={{
            backgroundColor: '#2ECC71', // Deep Green
            width: `${ savedBalancePercentage }%`,
          }}
        />
        { /* If we had negative spending this month, let's include it in the saved row */ }
        <Box
          sx={{
            backgroundColor: "#A9DFBF", // Light Green
            width: `${ actual < 0 ? actualPercentage : 0 }%`,
          }}
        />
      </Box>
      
      { /* SPENT progress bar */ }
      <Box width="100%" display="flex" height="10px"
        sx={{
          position: 'absolute',
          top: '5px',
          left: 0, 
          zIndex: '2',
        }}>
        { /* Current month's spending */ }
        <Box
          sx={{
            height: 10,
            width: `${
              (actualPercentage < budgetPercentage + savedBalancePercentage ) ? 
              actualPercentage :
              budgetPercentage + savedBalancePercentage
            }%`,
            backgroundColor: "#3498DB", // Dark Blue
          }}
        />
        { /* Previously spent based on balance */ }
        <Box
          sx={{
            height: 10,
            width: `${
              (actualPercentage + spentBalancePercentage < budgetPercentage + savedBalancePercentage ) ?
              spentBalancePercentage :
              budgetPercentage + savedBalancePercentage - actualPercentage
            }%`,
            backgroundColor: "#E67E22", // Deep Orange
          }}
        />
        { /* Over spent beyond our balance */ }
        <Box
          sx={{
            height: 10,
            width: `${
              (actualPercentage + spentBalancePercentage > budgetPercentage + savedBalancePercentage) ?
              actualPercentage + spentBalancePercentage - budgetPercentage - savedBalancePercentage : 0
            }%`,
            backgroundColor: "#C0392B", // Bright Red
          }}
        />
      </Box>
      {/* Wrapper for SPENT progress bar with border */}
      { totalSpent > 0 && 
        <Box display="flex" height="10px"
          sx={{
            position: 'absolute',
            top: '5px',
            left: 0,
            zIndex: '3',
            border: '1px solid black',
            boxSizing:'border-box',
            width: `${(totalSpent / maxTotal) * 100}%`,
          }}
        />
      }
      <Typography
        variant="body2"
        sx={{
          position: "absolute",
          top: "18px",
          right: "0",
          fontSize: "0.75rem",
          fontWeight: "bold",
          color: "black",
          zIndex: '1',
        }}
      >
        Balance: {formatWholeCurrency(balance)}
      </Typography>
    </Box>
  );
};

export default ProgressBar;
  
