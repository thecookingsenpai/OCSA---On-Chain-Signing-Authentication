// INFO This library relies on ethers.js

var provider;
var signer;
var address;

var session_token_storage;

const server = "http://193.187.129.116:9000"

async function connect() {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    // Prompt user for account connections
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    address = await signer.getAddress();
    console.log("Connected to: " + address);
    return address
}

async function login() {
    // Fetching our public ip
    var response = await fetch("https://api.ipify.org?format=json");
    var data = await response.json();
    var ip = data.ip;
    // Get the message from the server
    var HEADERS = new Headers ({"User-Agent": "Auther"})
    var response = await fetch(server + "/auth/hello/" + ip, {headers: HEADERS });
    var data = await response.json();
    var session_token = data.session_token;
    console.log("Session token: " + session_token);
    var message = data.message;
    console.log("Message: " + message);
    // Sign the message
    var signature = await signer.signMessage(message);
    // Send the signature to the server
    var response = await fetch(server + "/auth/response/", { headers: HEADERS, method: "POST", body: JSON.stringify({ session_token: session_token, message: message, signature: signature, address: address, ip: ip }) });
    var data = await response.json();
    console.log(data);
    session_token_storage = session_token;
    if (data.verified) {
        return "Authenticated"
    } else {
        return "NOPE"
    }
}