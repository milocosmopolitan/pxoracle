// Viewer-request CloudFront Function for a private S3 REST origin + OAC.
// Real asset paths and missing files are not rewritten to the app shell.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) request.uri += 'index.html';
  else if (!uri.split('/').pop().includes('.')) request.uri += '/index.html';
  return request;
}
