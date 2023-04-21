
var res = // designed to give info to browser users, who are disturbed
// when they see http errors in the console
function explainError(status, str) {
    // We assume Node users don't need to see this warning
    process?.arch || console.log('info', 'The above ' + status + ' is totally normal. ' + str);
}

export default res;
