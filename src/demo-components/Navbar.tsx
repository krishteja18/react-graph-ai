/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Button } from './Button';

export function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <nav className="flex justify-between p-4 bg-white border-b">
      <div className="font-bold">ReactScope Demo</div>
      <div>
        <Button 
          label={isLoggedIn ? 'Logout' : 'Login'} 
          onClick={() => setIsLoggedIn(!isLoggedIn)} 
        />
      </div>
    </nav>
  );
}
