import esbuild from 'esbuild';
import fs from 'fs';
import { consoleStyle } from './console-styles.js';

const versionRegex = /@version(\s+)([\d.]+)/;

console.log(`${consoleStyle.BLUE}Starting bundling...${consoleStyle.RESET}`);


let meta = fs.readFileSync('src/header.meta.js', 'utf8');

const version = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version.toString();
const current = meta.match(versionRegex)[2];
if (version !== current) {
    meta = meta.replace(versionRegex, `@version$1${version}`);

    fs.writeFileSync('src/header.meta.js', meta);
    console.log(`${consoleStyle.GREEN}Updated${consoleStyle.RESET} userscript version to ${consoleStyle.MAGENTA}${version}${consoleStyle.RESET}`);
}

// Compile the JS files
await esbuild.build({
    entryPoints: ['dist/app.js'], // "Infect" the files from this point (it spreads from this "patient 0")
    bundle: true, // Should the code be bundled?
    outfile: 'out/Camoverlay.user.js', // The file the bundled code is exported to
    format: 'esm', // What format the bundler bundles the code into
    target: 'esnext', // What is the minimum version/year that should be supported?
    platform: 'browser', // The platform the bundled code will be operating on
    legalComments: 'inline', // What level of legal comments are preserved? (Hard: none, Soft: inline)
    minify: false, // Should the code be minified?
    write: true, // Should we write the outfile to the disk?
    banner: { // Userscript banner
        js: meta
    }
}).catch(() => process.exit(1));

const svgs = new Map();
for (const file of fs.readdirSync('src/assets')) {
    if (!file.endsWith('.svg'))
        continue;

    svgs.set(file.slice(0, -4), fs.readFileSync(`src/assets/${file}`, 'utf8'));
}

// Correct inconsistent end of lines, and inject html, css and svgs
fs.writeFileSync(
    'out/Camoverlay.user.js',
    fs.readFileSync('out/Camoverlay.user.js', 'utf8')
        .replace('%overlay.html%', fs.readFileSync('src/assets/overlay.html', 'utf8'))
        .replace('%overlay.css%', fs.readFileSync('src/assets/overlay.css', 'utf8'))
        .replaceAll(/(\r\n\s*)<!--%svg%([a-z]+)-->/g, (_, whitespace, name) => whitespace + svgs.get(name).replaceAll('\r\n', whitespace))
        .replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'),
    'utf8'
);


console.log(`${consoleStyle.GREEN + consoleStyle.BOLD + consoleStyle.UNDERLINE}Bundling complete!${consoleStyle.RESET}`);
