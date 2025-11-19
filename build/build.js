import esbuild from 'esbuild';
import fs from 'fs';
import { consoleStyle } from './console-styles.js';

console.log(`${consoleStyle.BLUE}Starting bundling...${consoleStyle.RESET}`);


const metaContent = fs.readFileSync('src/header.meta.js', 'utf8');

// Compile the JS files
await esbuild.build({
    entryPoints: ['dist/app.js'], // "Infect" the files from this point (it spreads from this "patient 0")
    bundle: true, // Should the code be bundled?
    outfile: 'out/Camoverlay.user.js', // The file the bundled code is exported to
    format: 'iife', // What format the bundler bundles the code into
    target: 'esnext', // What is the minimum version/year that should be supported?
    platform: 'browser', // The platform the bundled code will be operating on
    legalComments: 'inline', // What level of legal comments are preserved? (Hard: none, Soft: inline)
    minify: false, // Should the code be minified?
    write: true, // Should we write the outfile to the disk?
    banner: { // Userscript banner
        js: metaContent
    }
}).catch(() => process.exit(1));

// Correct inconsistent end of lines, and inject html and css
fs.writeFileSync(
    'out/Camoverlay.user.js',
    fs.readFileSync('out/Camoverlay.user.js', 'utf8')
        .replace('%overlay.html%', fs.readFileSync('src/overlay.html', 'utf8').replace(/<!--%%-->\s*/g, ''))
        .replace('%overlay.css%', fs.readFileSync('src/overlay.css', 'utf8'))
        .replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'),
    'utf8'
);


console.log(`${consoleStyle.GREEN + consoleStyle.BOLD + consoleStyle.UNDERLINE}Bundling complete!${consoleStyle.RESET}`);
