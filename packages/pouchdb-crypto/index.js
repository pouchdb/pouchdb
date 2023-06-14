export async function digestFromMessage(message,algo='SHA-256') {
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
            }
            // Fails by design with wrong format            
            return formats[format]();
        } 
    }
}
// Old But gold
const toBase64 = (arrayBuffer) => btoa(String.fromCharCode(
  ...new Uint8Array(arrayBuffer)
));
  
function blobToBase64(blobOrBuffer, callback) {
   new Response(blobOrBuffer).arrayBuffer().then(toBase64).then(
   (b64)=>callback(null,b64),err=>callback(err));
   //callback(blobOrBuffer.toString('binary'));
}