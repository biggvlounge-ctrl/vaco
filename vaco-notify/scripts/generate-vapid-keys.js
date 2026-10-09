#!/usr/bin/env node
// VACO Notify -- generate a VAPID key pair for the webpush channel.
//
// Run once per deployment and keep the private key secret (an env var,
// never committed). The public key is not a secret -- it is handed to
// every browser that subscribes, via GET /api/webpush/public-key.
//
// This is the whole setup cost for real browser push: no account, no
// signing certificate, no vendor dashboard. Compare APNs/FCM, which
// need an Apple developer account or a Google Cloud project before a
// single notification can be sent.

'use strict';

const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('Add these to your environment (.env, or your host\'s secrets panel):');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@yourdomain.example');
console.log('');
console.log('The public key is also what a browser client passes to');
console.log('pushManager.subscribe({ applicationServerKey: publicKey }) --');
console.log('or just fetch it from GET /api/webpush/public-key at runtime');
console.log('instead of hardcoding it client-side.');
