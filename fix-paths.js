/*
 * Created Date: Wednesday, November 15th 2023, 11:19:25 am
 * Author: Andreas Behler
 * -----
 * Last Modified:
 * Modified By:
 * -----
 * Copyright (c) 2023 gid GmbH
 * ------------------------------------
 */
import fs from 'fs';
import path from 'path';

const indexPath = path.join('public', 'index.html');

fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading index.html:', err);
        return;
    }

    const result = data
        .replace(/"\/build\//g, '"./build/')
        .replace(/'\/favicon-gwweb\.ico'/g, "'./favicon-gwweb.ico'");

    fs.writeFile(indexPath, result, 'utf8', (error) => {
        if (error) {
            console.error('Error writing index.html:', error);
        } else {
            console.log('Updated index.html with relative paths.');
        }
    });
});