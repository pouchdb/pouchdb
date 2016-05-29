import console from './console.js';

// designed to give info to browser users, who are disturbed
// when they see http errors in the console
function explainError(status, str) {
  console('info', 'The above ' + status + ' is totally normal. ' + str);
}

export default explainError;
