import { g as guardedConsole } from './guardedConsole-f54e5a40.js';

// designed to give info to browser users, who are disturbed
// when they see http errors in the console
function explainError(status, str) {
  guardedConsole('info', 'The above ' + status + ' is totally normal. ' + str);
}

export { explainError as e };
