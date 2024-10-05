import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Callback } from './components/Callback.tsx';
import { App } from './App.tsx';


export const Home: React.FC = () => {
  console.log("Home");

  return (
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route path="/*" element={<App />} />
      </Routes>
  );
};