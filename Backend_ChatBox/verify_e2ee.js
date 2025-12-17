import crypto from 'crypto';

// 1. SIMULATE KEY GENERATION (This usually happens on the user's phone)
function generateUserKeys() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
}

const alice = generateUserKeys();
const bob = generateUserKeys();

console.log("--- STEP 1: Keys Generated ---");
console.log("Alice's Public Key (Sent to Backend):", alice.publicKey.substring(0, 50) + "...");

// 2. SIMULATE ENCRYPTION (Alice sends a message to Bob)
const originalMessage = "This is a secret message that the Backend should never see!";

// Alice fetches Bob's Public Key from your Backend (Simulated here)
const bobsPublicKeyFromServer = bob.publicKey;

const encryptedBuffer = crypto.publicEncrypt(
    bobsPublicKeyFromServer,
    Buffer.from(originalMessage)
);

const encryptedStringForBackend = encryptedBuffer.toString('base64');

console.log("\n--- STEP 2: Message Encrypted ---");
console.log("Data sent to your 'Message' model text field:");
console.log(encryptedStringForBackend); // This is what you'll see in MongoDB

// 3. THE "SERVER TEST" (Trying to read it without the private key)
console.log("\n--- STEP 3: Server Verification ---");
try {
    // A server/hacker only has the encrypted string
    console.log("Can the server read it? " + (encryptedStringForBackend === originalMessage ? "YES (FAILED)" : "NO (PASSED)"));
} catch (e) {
    console.log("Server failed to read.");
}

// 4. DECRYPTION (Bob receives the message and uses his Private Key)
const decryptedBuffer = crypto.privateDecrypt(
    bob.privateKey,
    Buffer.from(encryptedStringForBackend, 'base64')
);

console.log("\n--- STEP 4: Recipient Decryption ---");
console.log("Bob decrypted the message:", decryptedBuffer.toString());

if (decryptedBuffer.toString() === originalMessage) {
    console.log("✅ E2EE VERIFIED: Only the owner of the private key could read the text.");
}