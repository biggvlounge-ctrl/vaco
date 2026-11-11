#!/usr/bin/env node
'use strict';
const path=require('node:path');
const {importTIGERFile}=require('../backend/tiger-import');
const args=process.argv.slice(2);
const input=args.find(x=>!x.startsWith('--'));
const vintageArg=args.find(x=>x.startsWith('--vintage='));
const vintage=vintageArg?Number(vintageArg.split('=')[1]):undefined;
if(!input||input.startsWith('--')){console.error('Usage: npm run geography:import -- <path-to-tiger-county.csv|json|geojson> [--vintage=2026]');process.exit(2);}
try{const result=importTIGERFile(path.resolve(input),{vintage});console.log(JSON.stringify({...result,note:'Geography import only. Local source portals and parcel/ownership coverage remain unassessed.'},null,2));}catch(error){console.error(`TIGER import failed: ${error.message}`);process.exit(1);}
