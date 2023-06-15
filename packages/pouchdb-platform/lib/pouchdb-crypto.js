async function digestFromMessage(message,algo='SHA-256') {
    const msgUint8 = new TextEncoder().encode(message);
    const arrayBuffer = await crypto.subtle.digest(algo, msgUint8); // hash the message
        
    return { 
        digist(format='hex') {
            const formats = {
                hex: () => 
                Array.from(new Uint8Array(arrayBuffer))
                // converted buffer to byte array
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(""), // converted bytes to hex string;
            };
            // Fails by design with wrong format            
            return formats[format]();
        } 
    };
}

 
const base64encoderStream = {
    transform(data,ready) {
        let reader = new FileReader();        
        reader.onloadend = () => {
            ready.enqueue(reader.result.split(';base64,',1));
            reader = null;
        };
        reader.readAsDataURL(new Blob(data));
    }
};

//new TransformStream(base64encoderStream)

// Old But gold
function blobToBase64(blobOrBuffer, callback) {
    new Response(blobOrBuffer).arrayBuffer().then((arrayBuffer) => btoa(
    String.fromCharCode(
    ...new Uint8Array(arrayBuffer)
    ))).then((b64)=>callback(null,b64),err=>callback(err));
   //callback(blobOrBuffer.toString('binary'));
}
// eg "digest":"md5-yDbs1scfYdqqLpxyFb1gFw==",
// base642hex new Buffer('yDbs1scfYdqqLpxyFb1gFw==', 'base64').toString('hex')
// hex2base64 new Buffer('c836ecd6c71f61daaa2e9c7215bd6017', 'hex').toString('base64')

// Returns only the ${base64Data}
// Reverse: await fetch(`data:${'image/jpeg'||''};base64,${base64Data}`);
const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result.split('base64,',1)[1]);
    };
    reader.readAsDataURL(new Blob([].concat(blob)));
});


//import { md5, sha1, sha512, sha3 } from 'hash-wasm'
// replaces stringMd5 returns hex should also use message.normalize('NFKC')
const createoldMD5 = (message="") => import('./hash-wasm.js').then(({ md5 }) => md5(new TextEncoder().encode(message)));
const stringMd5 = async (message="") => (await import('./hash-wasm.js')).md5(message);

export { base64encoderStream, blobToBase64, createoldMD5, digestFromMessage, stringMd5, toBase64 };
