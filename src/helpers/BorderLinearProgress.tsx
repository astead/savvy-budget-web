import React from 'react';
import { Box } from '@mui/material';

interface ProgressBarProps {
  actual: number;
  budget: number;
  balance: number;
  isIncome: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ actual, budget, balance, isIncome }) => {
  let prevBalance = balance + actual - budget;
  
  if (isIncome) {
    prevBalance = -1 * balance + actual - budget;
  }
  
  const totalSaved = 
    (budget > 0 ? budget : 0) + 
    (actual < 0 ? (-1 * actual) : 0) + 
    (prevBalance > 0 ? prevBalance : 0);

  const totalSpent = 
    (actual > 0 ? actual : 0) +
    (budget < 0 ? (-1 * budget) : 0) + 
    (prevBalance < 0 ? -1 * prevBalance : 0);
  
  const maxTotal = Math.max(totalSaved, totalSpent);

  //const totalSavedPercentage = (totalSaved === 0) ? 0 : (totalSaved / maxTotal) * 100;
  const totalSpentPercentage = (totalSpent === 0) ? 0 : (totalSpent / maxTotal) * 100;

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
        { /* SPENDING category: Current month's budget */ 
          !isIncome &&
          <>
            { /* Current budget */ }
            <Box
              sx={{
                backgroundColor: "#85C1E9", //Light Blue
                width: `${budgetPercentage}%`,
              }}
            />
            { /* Previously saved based on balance */ }
            <Box
              sx={{
                backgroundColor: "#2ECC71", // Medium Green
                width: `${
                  isIncome ?
                  (budgetPercentage > totalSpentPercentage ? totalSpentPercentage : budgetPercentage) :
                  savedBalancePercentage
                }%`,
              }}
            />
            { /* If we had negative spending this month, let's include it in the saved row */ }
            <Box
              sx={{
                backgroundColor: "#A9DFBF", // Light Green
                width: `${ actual < 0 ? actualPercentage : 0 }%`,
              }}
            />
          </>
        }
        { /* INCOME category: Current month's budget */ 
          isIncome &&
          <>
            { /* Current income budget with matching earned income */ }
            <Box
              sx={{
                backgroundColor: "#85C1E9", //Light Blue
                width: `${
                  (budgetPercentage > totalSpentPercentage ? 
                    totalSpentPercentage : 
                    budgetPercentage)
                }%`,
              }}
            />
            { /* Current month's income budget with unearned income */ }
            <Box
              sx={{
                backgroundColor: "#F4D03F", // Soft Yellow (gentle caution)
                width: `${
                  budgetPercentage > totalSpentPercentage ?
                  budgetPercentage - totalSpentPercentage :
                  0
                }%`,
              }}
            />
            { /* Previously unearned income based on balance */ }
            <Box
              sx={{
                backgroundColor: "#E67E22", // Deep Orange
                width: `${ savedBalancePercentage }%`,
              }}
            />
            { /* If we had negative earned income this month */ }
            <Box
              sx={{
                backgroundColor: "#C0392B", // Bright Red
                width: `${ actual < 0 ? actualPercentage : 0 }%`,
              }}
            />
          </>
        }
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
        { /* Over spent in the current month beyond our balance */ }
        <Box
          sx={{
            height: 10,
            width: `${
              (actualPercentage > budgetPercentage + savedBalancePercentage ) ? 
              actualPercentage - (budgetPercentage + savedBalancePercentage) :
              0
            }%`,
            backgroundColor:
              // For income, additional income is good, so we mark it as green, 
              // otherwise red for overspending
              isIncome ? 
                "#27AE60" // Deep Green
                : "#C0392B" // Bright Red
          }}
        />
        { /* Previously spent based on balance */ }
        <Box
          sx={{
            height: 10,
            width: `${spentBalancePercentage}%`,
            backgroundColor:
              // For income, previous carryover additional income is good, so mark it as green,
              // otherwise orange for carryover overspending
              isIncome ? 
                "#2ECC71" // Medium Green
                : "#E67E22" // Deep Orange 
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
            width: `${totalSpentPercentage}%`,
          }}
        />
      }
    </Box>
  );
};

export default ProgressBar;
  
