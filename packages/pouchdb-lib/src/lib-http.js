// /**
//  * Creates a new sharedWorker for WInterOP Environments
//  * 
//  */

// /**
//  * Creates a new sharedWorker for nodejs 
//  * runs a main netSocket Component
//  * and a workerThread per request.
//  * @param {*} socketFilePath 
//  */
// const sharedWorker = (socketFilePath) => {

// }
// { // NodeJS 10 Request Workers Max.
//     import('node:worker_threads').then(({
//         isMainThread,
//         BroadcastChannel,
//         Worker,
//     }) => {
//         const bc = new BroadcastChannel('hello');
      
//         if (isMainThread) {
//           let c = 0;
//           bc.onmessage = (event) => {
//             console.log(event.data);
//             if (++c === 10) bc.close();
//           };
//           for (let n = 0; n < 10; n++)
//             new Worker(__filename);
//         } else {
//           bc.postMessage('hello from every worker');
//           bc.close();
//         }
//     });
      
    
// }



//     port.onmessage = data => {
//         const [requestHeader, ...bodyContent] = data.toString().split('\r\n\r\n');

//         const [firstLine, ...otherLines] = requestHeader.split('\n');
//         const [method, path, httpVersion] = firstLine.trim().split(' ');
//         const headers = Object.fromEntries(otherLines.filter(_=>_)
//             .map(line=>line.split(':').map(part=>part.trim()))
//             .map(([name, ...rest]) => [name, rest.join(' ')]));

//         var body;
//         try {
//             body = JSON.parse(bodyContent);
//         } catch (err) {/* ignore */}


//         const request = {
//             method, 
//             path,
//             httpVersion,
//             headers,
//             body
//         };
//         console.log(request);
//         port.postMessage(`HTTP/1.1 200 OK\n\nhallo ${request.body.name}`);
//     };


// // node onconnect
// new ReadableStream({
//   start(c) { 

//     require('net').createServer(c.enqueue); 
// },
// }).pipeThrough(new TramsformStream({transform(port,handler) {
//     const channel = new MessageChannel();
//     channel.port1.onmessage = (res) => port.write(res) ? socket.end((err)=>{console.log(err);}) : socket.end((err)=>{console.log(err);});
//     port.on('data', (httpRequest) => handler.enqueue([httpRequest,channel.port2]));
// }})).pipeTo(onRequest);;

// const sharedWorkerOnConnectStream = new ReadableStream({
//   start(c) { globalThis.onconnect = ({ports:[port]}) => c.enqueue(port); },
// });
// // Accepts httpRequest as string and a port of type MessageChannel.
// const onRequest = new WriteableStream({write([data,port]) {
//         console.log(data.toString());
//         const [firstLine, ...otherLines] = data.toString().split('\n');
//         const [method, path, httpVersion] = firstLine.trim().split(' ');
//         const headers = Object.fromEntries(otherLines.filter(_=>_)
//             .map(line=>line.split(':').map(part=>part.trim()))
//             .map(([name, ...rest]) => [name, rest.join(' ')]));


//         const request = {
//             method, path, httpVersion, headers
//         };
//         console.log(request);
//         const name = request.path.split('/')[1];
//         port.postMessage(`HTTP/1.1 200 OK\n\nhallo ${name}`);
// }});



// // port is == MessageChannel
// const sharedWorkerRequestStream = new TramsformStream({transform(port,handler) {
//       port.on('message', (httpRequest) => handler.enqueue([httpRequest, port]));
// }});
// sharedWorkerOnConnectStream.pipeThrough(sharedWorkerRequestStream).pipeTo(onRequest);
