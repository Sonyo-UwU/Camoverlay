// ==UserScript==
// @name         Camoverlay
// @namespace    https://github.com/Sonyo-UwU/
// @version      0.0.1
// @description  A remake of Blue Marble
// @author       Sonyo
// @license      ISC
// @icon         https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg
// @source       https://github.com/Sonyo-UwU/Camoverlay
// @updateURL    https://github.com/Sonyo-UwU/Camoverlay/raw/refs/heads/main/out/Camoverlay.user.js
// @downloadURL  https://raw.githubusercontent.com/Sonyo-UwU/Camoverlay/main/out/Camoverlay.user.js
// @match        https://wplace.live/*
// @run-at       document-body
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

"use strict";
(() => {
  // dist/display.js
  function injectOverlay() {
    document.body.appendChild(document.createElement("div")).outerHTML = `
<div id="ca-overlay">
    <div id="ca-header">
        <img src="https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg" />
        <h1>Camoverlay</h1>
    </div>
    <hr />
    <div>
        <p>Username: <b id="ca-user-name"></b></p>
        <p>Droplets: <b id="ca-user-droplets"></b></p>
        <p>Next level in: <b id="ca-user-level">...</b> pixels</p>
    </div>
    <hr />
    <div id="ca-automation">
        <div id="ca-coords">
            <button id="ca-coords-button" class="ca-icon-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 6">
                    <circle cx="2" cy="2" r="2"></circle>
                    <path d="M2 6 L3.7 3 L0.3 3 Z"></path>
                    <circle cx="2" cy="2" r="0.7" fill="white"></circle>
                </svg>
            </button><input id="ca-input-tx" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl X" /><input id="ca-input-ty" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl Y" /><input id="ca-input-px" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px X" /><input id="ca-input-py" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px Y" />
        </div>
        <div id="ca-templates">
            <div>
                <input id="ca-file-input" type="file" accept="image/png, image/jpeg, image/webp, image/bmp, image/gif" />
                <button id="ca-upload-button">Upload template</button>
            </div>
            <div id="ca-template-buttons">
                <button id="ca-enable-button">Enable</button>
                <button id="ca-create-button">Create</button>
                <button id="ca-disable-button">Disable</button>
            </div>
        </div>
        <textarea id="ca-output" readonly placeholder="Sleeping"></textarea>
        <div id="ca-bottom">
            <div>
                <button class="ca-icon-button">🎨</button><button class="ca-icon-button">🌐</button>
            </div>
            <small>
                Made by Sonyo
                <br>
                Original by SwingTheVine
                <br>
                Art by <a href="https://camomille1411en.carrd.co/" target="_blank">camomille1411</a>
            </small>
        </div>
    </div>
</div>
`;
    GM_addStyle(`
#ca-overlay {
    background-color: #5D1F18E6;
    border-radius: 8px;
    color: white;
    padding: 10px;
    position: absolute;
    right: 75px;
    top: 10px;
    width: auto;
    z-index: 29;
}

div#ca-overlay {
    /* Font stack is as follows:
   * Highest Priority (Roboto Mono)
   * Windows fallback (Courier New)
   * macOS fallback (Monaco)
   * Linux fallback (DejaVu Sans Mono)
   * Any possible monospace font (monospace)
   * Last resort (Arial) */
    font-family: 'Roboto Mono', 'Courier New', 'Monaco', 'DejaVu Sans Mono', monospace, 'Arial';
    letter-spacing: 0.05em;
}

#ca-overlay h1 {
    display: inline-block;
    font-size: x-large;
    font-weight: bold;
    vertical-align: middle;
}

#ca-overlay hr {
    margin: 0.5em 0;
}

#ca-overlay small {
    font-size: x-small;
    color: lightgray;
    margin-top: 0;
    text-align: right;
}

#ca-header img {
    border-radius: 12px;
    display: inline-block;
    height: 2.5em;
    margin-right: 1ch;
    vertical-align: middle;
}

#ca-overlay button {
    background-color: #cb4334;
    border-radius: 1em;
    padding: 0 0.75ch;
}
#ca-overlay button:hover, #ca-overlay button:focus-visible {
    background-color: #d16458;
}
#ca-overlay button:active, #ca-overlay button:disabled {
    background-color: #d68d85;
}
#ca-overlay button:disabled {
    text-decoration: line-through;
}

#ca-templates > * {
    margin-top: 0.5em;
}

#ca-file-input {
    display: none !important;
}
#ca-file-input + button {
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#ca-template-buttons {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    align-items: center;
    gap: 1ch;
}

#ca-output {
    font-size: small;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0 0.5ch;
    margin-top: 0.5em;
    height: 7.5em;
    width: 100%;
}

#ca-bottom {
    display: flex;
    justify-content: space-between;
}

.ca-icon-button {
    border: white 1px solid;
    height: 1.5em;
    width: 1.5em;
    padding: 0 !important; /* Overrides the padding in "#ca-overlay button" */
    line-height: 1em;
    text-align: center;
    vertical-align: middle;
}
.ca-icon-button svg {
    width: 50%;
    margin: 0 auto;
    fill: #111;
}

.ca-coords-input {
    appearance: auto;
    -moz-appearance: textfield;
    width: 5.5ch;
    margin-left: 1ch;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0 0.5ch;
    font-size: small;
}
.ca-coords-input::-webkit-outer-spin-button,
.ca-coords-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
`);
  }
  function importFont() {
    const stylesheetLink = document.createElement("link");
    stylesheetLink.href = "https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap";
    stylesheetLink.rel = "stylesheet";
    stylesheetLink.as = "style";
    document.head.appendChild(stylesheetLink);
  }
  function displayStatus(message) {
    const textArea = document.getElementById("ca-output");
    if (textArea !== null)
      textArea.value = message;
  }

  // dist/app.js
  importFont();
  injectOverlay();
  displayStatus("version " + GM_info.script.version);
})();
