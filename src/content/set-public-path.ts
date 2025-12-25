// Ensure webpack runtime loads additional chunks from extension origin
// Must run before any other imports in the content script bundle.
declare let __webpack_public_path__: string;
__webpack_public_path__ = chrome.runtime.getURL('/');


