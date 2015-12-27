// designed to give info to browser users, who are disturbed
// when they see http errors in the console
function explainError(status, str) {
  if ('console' in global && 'info' in console) {
    console.info('The above ' + status + ' is totally normal. ' + str);
  }
}

export default explainError;