import crypto from 'crypto';
import axios from 'axios';

// Test encryption integration between frontend and backend
const API_URL = 'http://localhost:3000';

// Generate test keys
function generateUserKeys() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
}

console.log('🔐 Testing End-to-End Encryption Integration\n');

const alice = generateUserKeys();
const bob = generateUserKeys();

console.log('1. Generated RSA key pairs for Alice and Bob');
console.log('Alice Public Key:', alice.publicKey.substring(0, 50) + '...\n');

// Test 1: Store public keys in backend
async function testPublicKeyStorage() {
    try {
        console.log('2. Testing public key storage...');
        
        // Create test users first - use unique emails each time
        const timestamp = Date.now();
        const aliceUser = {
            fullName: 'Alice Test',
            email: `alice${timestamp}@test.com`,
            password: 'password123'
        };
        
        const bobUser = {
            fullName: 'Bob Test', 
            email: `bob${timestamp}@test.com`,
            password: 'password123'
        };
        
        // Register users
        const aliceRes = await axios.post(`${API_URL}/api/auth/signup`, aliceUser);
        const bobRes = await axios.post(`${API_URL}/api/auth/signup`, bobUser);
        
        console.log('✅ Users created successfully');
        console.log('Alice token:', aliceRes.data.token?.substring(0, 20) + '...');
        console.log('Bob token:', bobRes.data.token?.substring(0, 20) + '...');
        
        // Store public keys
        const aliceKeyRes = await axios.put(`${API_URL}/api/users/public-key`, 
            { publicKey: alice.publicKey },
            { headers: { Authorization: `Bearer ${aliceRes.data.token}` }}
        );
        
        const bobKeyRes = await axios.put(`${API_URL}/api/users/public-key`,
            { publicKey: bob.publicKey },
            { headers: { Authorization: `Bearer ${bobRes.data.token}` }}
        );
        
        console.log('✅ Public keys stored successfully');
        console.log('Alice key response:', aliceKeyRes.data);
        console.log('Bob key response:', bobKeyRes.data);
        
        return { aliceId: aliceRes.data._id, bobId: bobRes.data._id, aliceToken: aliceRes.data.token, bobToken: bobRes.data.token };
        
    } catch (error) {
        console.error('❌ Public key storage failed:', error.response?.data || error.message);
        console.error('Full error:', error);
        return null;
    }
}

// Test 2: Retrieve public key and encrypt message
async function testMessageEncryption(users) {
    try {
        console.log('3. Testing message encryption...');
        
        // Alice gets Bob's public key
        const keyRes = await axios.get(`${API_URL}/api/users/public-key/${users.bobId}`,
            { headers: { Authorization: `Bearer ${users.aliceToken}` }}
        );
        
        console.log('✅ Retrieved Bob\'s public key');
        
        // Alice encrypts message for Bob
        const originalMessage = "This is a secret test message!";
        const encryptedBuffer = crypto.publicEncrypt(
            keyRes.data.publicKey,
            Buffer.from(originalMessage)
        );
        
        const encryptedMessage = encryptedBuffer.toString('base64');
        console.log('✅ Message encrypted:', encryptedMessage.substring(0, 50) + '...');
        
        return encryptedMessage;
        
    } catch (error) {
        console.error('❌ Message encryption failed:', error.response?.data || error.message);
        return null;
    }
}

// Test 3: Send encrypted message
async function testMessageSending(encryptedMessage, users) {
    try {
        console.log('4. Testing encrypted message sending...');
        
        const messageData = {
            text: encryptedMessage,
            receiverId: users.bobId
        };
        
        const msgRes = await axios.post(`${API_URL}/api/messages/send/${users.bobId}`, messageData,
            { headers: { Authorization: `Bearer ${users.aliceToken}` }}
        );
        
        console.log('✅ Encrypted message sent successfully');
        console.log('Message stored in DB:', msgRes.data.text.substring(0, 50) + '...');
        
        return msgRes.data.text;
        
    } catch (error) {
        console.error('❌ Message sending failed:', error.response?.data || error.message);
        return null;
    }
}

// Test 4: Verify server cannot read the message
async function testServerPrivacy(storedMessage) {
    try {
        console.log('5. Testing server privacy...');
        
        const isReadable = storedMessage.includes('secret') || storedMessage.includes('test');
        console.log(isReadable ? '❌ Server can read the message (FAILED)' : '✅ Server cannot read the message (PASSED)');
        
    } catch (error) {
        console.error('❌ Server privacy test failed:', error.message);
    }
}

// Test 5: Bob decrypts the message
async function testMessageDecryption(storedMessage) {
    try {
        console.log('6. Testing message decryption...');
        
        const decryptedBuffer = crypto.privateDecrypt(
            bob.privateKey,
            Buffer.from(storedMessage, 'base64')
        );
        
        const decryptedMessage = decryptedBuffer.toString();
        console.log('✅ Bob decrypted message:', decryptedMessage);
        
        if (decryptedMessage === "This is a secret test message!") {
            console.log('✅ End-to-end encryption VERIFIED successfully!');
        } else {
            console.log('❌ Decryption failed - messages don\'t match');
        }
        
    } catch (error) {
        console.error('❌ Message decryption failed:', error.message);
    }
}

// Run all tests
async function runTests() {
    const users = await testPublicKeyStorage();
    if (!users) return;
    
    const encryptedMessage = await testMessageEncryption(users);
    if (!encryptedMessage) return;
    
    const storedMessage = await testMessageSending(encryptedMessage, users);
    if (!storedMessage) return;
    
    await testServerPrivacy(storedMessage);
    await testMessageDecryption(storedMessage);
    
    console.log('\n🎉 Integration testing completed!');
}

runTests().catch(console.error);
