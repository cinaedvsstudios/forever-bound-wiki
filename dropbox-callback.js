(() => {
  const query = new URLSearchParams(location.search);
  if (window.opener && (query.has('code') || query.has('error')) && query.has('state')) {
    window.opener.postMessage({ type: 'capsanoto-dropbox-oauth', code: query.get('code'), error: query.get('error'), state: query.get('state') }, location.origin);
    history.replaceState(null, '', location.pathname);
    document.getElementById('message').textContent = 'Connection returned to Capsanoto. You can close this window.';
    window.close();
  } else document.getElementById('message').textContent = 'Open Connect Dropbox from Capsanoto to sign in.';
})();
