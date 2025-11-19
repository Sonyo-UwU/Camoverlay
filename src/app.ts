import { displayStatus, importFont, injectOverlay } from './display';
import { ScriptGetInfo } from './types';

declare const GM_info: ScriptGetInfo;


importFont();
injectOverlay();

// Display version
displayStatus('version ' + GM_info.script.version);
