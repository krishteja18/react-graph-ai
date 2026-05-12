/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navbar } from './Navbar';

export const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="p-8 text-center">
        <h2 className="text-2xl font-bold">Welcome to ReactScope</h2>
        <p className="text-gray-600 mt-2">The AI-powered React Graph Engine is currently analyzing this component.</p>
      </main>
    </div>
  );
};
