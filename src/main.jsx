/**
 * Single entry point for the app: React, the one stylesheet, and Bootstrap's JS.
 *
 * The stylesheet import is deliberately NOT bootstrap/dist/css/bootstrap.min.css
 * -- that is the untouched upstream bundle carrying Bootstrap's #0d6efd default
 * palette. styles.scss compiles Bootstrap from source with the V2 theme slotted
 * in above it (Spec 00002 Part P5), so the prebuilt bundle would only race the
 * themed output for the same selectors.
 *
 * It is imported here rather than from a second <script type="module"> tag so
 * that the CSS is part of this module graph and its insertion order is
 * determined by the bundler instead of by document script order.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './scss/styles.scss';
import 'bootstrap';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
