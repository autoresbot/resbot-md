/**
 * Edit pesan bot (strings.js) lewat form. Perubahan berlaku setelah restart
 * karena strings.js di-import sekali saat bot start.
 */

import fs from 'fs';
import path from 'path';
import express from 'express';
import { HttpError, writeModuleFile } from '../lib/files.js';
import { StringsFormError, readStringsForm, applyStringsForm } from '../lib/stringsForm.js';

function createStringsRouter(rootDir) {
  const router = express.Router();
  const file = path.join(rootDir, 'strings.js');

  const wrap = (fn) => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof StringsFormError) throw new HttpError(400, err.message);
      throw err;
    }
  };

  router.get('/', (req, res) => {
    const categories = wrap(() => readStringsForm(fs.readFileSync(file, 'utf-8')));
    res.json({ categories });
  });

  router.put('/', (req, res) => {
    const result = wrap(() => applyStringsForm(fs.readFileSync(file, 'utf-8'), req.body?.values));
    if (result.changed.length) writeModuleFile(rootDir, 'strings.js', result.source);
    res.json({ ok: true, changed: result.changed });
  });

  return router;
}

export { createStringsRouter };
