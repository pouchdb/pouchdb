//Futon in one file
//inpired on mobilefuton
//

Futon = function() {
    showAllDbs : function {
        console.log(
            window.webkitIndexedDB.getDatabaseNames()
        );
    }
}
window.export = Futon;
