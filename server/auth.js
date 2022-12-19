// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })
const ethers = require('ethers')
const { hashMessage } = require("@ethersproject/hash");

var timeout = 3 // In minutes
var sessions = {}

// NOTE Verify signature method
async function verifySignature(message, signature, address) {
    var derived = ethers.utils.recoverAddress(hashMessage(message),signature);
    console.log("Derived: " + derived)
    console.log("Address: " + address)
    if (derived == address) {
        return true;
    }
    return false;
}

function generateUID() {
    // I generate the UID from two parts here 
    // to ensure the random number provide enough bits.
    var uid = "";
    for (var i = 0; i < 12; i++) {
        var part = (Math.random() * 46656) | 0;
        part = (part.toString(36)).slice(-3);
        uid += part;
    }
    return uid;
}

function getSessions() {
    return sessions
}

// Declare a route
fastify.get('/', async (request, reply) => {
    // Allow cross origin requests
    reply.header("Access-Control-Allow-Origin", "*");
    console.log('request', request)
    return { hello: 'world' }
})

fastify.get("/auth/hello/:ip", async (request, reply) => {
    // Allow cross origin requests
    reply.header("Access-Control-Allow-Origin", "*");
    // Get the ip from the request
    var derived_ip = request.raw.connection.remoteAddress
    console.log("Derived IP: " + derived_ip)
    var ip = request.params.ip
    console.log(ip)
    // Ip checking
    if (derived_ip == "127.0.0.1" || derived_ip == "::ffff:" || derived_ip == '::1') {
        console.log("Localhost")
    } else {
        console.log("Not localhost")
        if (derived_ip != ip) {
            console.log("IP mismatch")
            return { error: "IP mismatch" }
        }
    }
    // Create a uid
    var session_token = generateUID()
    // Generate a random message based on timestamp
    var message = "Hello_" + Date.now() + "_" + session_token + "_" + Math.random()
    message = message.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
    message = message.trim()
    // Store the message in the session overwriting any previous message
    sessions[session_token.toString()] = { message: message, timeout: Date.now() + 1000 * 60 * timeout, ip: ip, verified: false } // x minutes timeout
    console.log("Message: " + message
        + " Timeout: " + sessions[session_token.toString()].timeout
        + " Session token: " + session_token)
    console.log(sessions)
    return { message: message, session_token: session_token }
})

// Sign based authentication
fastify.post("/auth/response/", async (request, reply) => {
    var local_sessions = getSessions()
    console.log(local_sessions)
    // Allow cross origin requests
    reply.header("Access-Control-Allow-Origin", "*");
    // Parse the json
    var data = request.body
    data = JSON.parse(data)
    console.log(data)
    var session_token = data.session_token
    console.log("Session token: " + session_token)
    var message = data.message
    console.log("Message: " + message)
    var signature = data.signature
    console.log("Signature: " + signature)
    var address = data.address
    console.log("Address: " + address)
    var derived_ip = request.raw.connection.remoteAddress
    console.log("Derived IP: " + derived_ip)
    var ip = data.ip
    console.log("IP: " + ip)
    // Ip checking
    if (derived_ip == "127.0.0.1" || derived_ip == "::ffff:" || derived_ip == '::1') {
        console.log("Localhost")
    } else {
        console.log("Not localhost")
        if (derived_ip != ip) {
            console.log("IP mismatch")
            return { error: "IP mismatch" }
        }
    }
    // Check if the session_token is in the session
    if (!(session_token in local_sessions)) {
        return { verified: false, error: "No session found" }
    }
    // Check if the message is the same as the one we sent and clear the session
    if (message != local_sessions[session_token].message) {
        local_sessions[session_token] = null
        return { verified: false, error: "Message does not match" }
    }
    // Check for timeout and clear the session
    if (local_sessions[session_token].timeout < Date.now()) {
        local_sessions[session_token] = null
        return { verified: false, error: "Session timed out" }
    }
    // Ensure ip is the same
    if (local_sessions[session_token].ip != ip) {
        local_sessions[session_token] = null
        return { verified: false, error: "IP does not match" }
    }
    // Verify signature
    var verified = await verifySignature(message, signature, address)
    console.log("Verified: " + verified)
    local_sessions[session_token].verified = verified
    return { verified: verified, error: null }
})

fastify.post("/check", async (request, reply) => {
    // Allow cross origin requests
    reply.header("Access-Control-Allow-Origin", "*");
    // Parse the json
    var data = request.body
    data = JSON.parse(data)
    console.log(data)
    var session_token = data.session_token
    console.log("Session token: " + session_token)
    var derived_ip = request.raw.connection.remoteAddress
    console.log("Derived IP: " + derived_ip)
    var ip = data.ip
    console.log("IP: " + ip)
    // Ip checking
    if (derived_ip == "127.0.0.1" || derived_ip == "::ffff:" || derived_ip == '::1') {
        console.log("Localhost")
    } else {
        console.log("Not localhost")
        if (derived_ip != ip) {
            console.log("IP mismatch")
            return { error: "IP mismatch" }
        }
    }
    // Check if the session_token is in the session
    if (!(session_token in sessions)) {
        return { authorized: false, error: "No session found" }
    }
    // Check for timeout and clear the session
    if (sessions[session_token].timeout < Date.now()) {
        sessions[session_token] = null
        return { authorized: false, error: "Session timed out" }
    }
    // Ensure ip is the same
    if (sessions[session_token].ip != ip) {
        sessions[session_token] = null
        return { authorized: false, error: "IP does not match" }
    }
    // Check if the session is verified
    if (sessions[session_token].verified == false) {
        return { authorized: false, error: "Session not verified" }
    }
    return { authorized: true, error: null, timeout: sessions[session_token].timeout}
})

const start = async () => {

    // Run the api server
    try {
        await fastify.listen({ host: "0.0.0.0", port: 9000 })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()