import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import './includes/styles.css';
import Loading from './helpers/loading.js';
import { HomePage } from './components/homePage.tsx';
import { Charts } from './components/Charts.tsx';
import { Transactions } from './components/Transactions.tsx';
import { Envelopes } from './components/Envelopes.tsx';
import { Configure } from './components/Configure.tsx';


export const App: React.FC = () => {
  const { isLoading } = useAuth0();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/Charts/:in_envID" element={<Charts />} />
        <Route path="/Transactions/:in_catID/:in_envID/:in_force_date/:in_year/:in_month" element={<Transactions />} />
        <Route path="/Envelopes" element={<Envelopes />} />
        <Route path="/Configure" element={<Configure />} />
      </Routes>
    </Router>
  );
};