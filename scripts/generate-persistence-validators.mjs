import {readFileSync,writeFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import standalone from 'ajv/dist/standalone/index.js';
const schemas=JSON.parse(readFileSync('packages/contracts/schemas/astrology.json','utf8'));
const ajv=new Ajv2020({strict:false,validateFormats:false,code:{source:true,esm:true}});
ajv.addSchema(schemas.input,'birth');ajv.addSchema(schemas.astrology,'chart');
writeFileSync('apps/web/src/features/persistence-validators.ts','// @ts-nocheck\n// Generated from Rust wire schemas by scripts/generate-persistence-validators.mjs.\n'+standalone(ajv,{validateBirth:'birth',validateChart:'chart'})+'\n');
