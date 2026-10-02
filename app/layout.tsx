import './globals.css';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'Strategy Lab // Investment Research Console',
  description: 'Sleek quantitative stock evaluation and strategy tracker.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}