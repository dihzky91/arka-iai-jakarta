import * as schema from '../db/schema';
import { pgGenerate } from 'drizzle-dbml-generator';

const out = './schema.dbml';     // nama file output
const relational = true;         // recommended (pakai relations Drizzle)

pgGenerate({ schema, out, relational });

console.log('✅ schema.dbml berhasil dibuat!');