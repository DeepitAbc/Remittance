
require("file-loader?name=../index.html!../index.html");

const Web3 = require("web3");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
// Not to forget our built contract
const remittanceJson = require("../../build/contracts/Remittance.json");



// Supports Metamask, and other wallets that provide / inject 'web3'.
if (typeof web3 !== 'undefined') {
    // Use the Mist/wallet/Metamask provider.
    window.web3 = new Web3(web3.currentProvider);
} else {
    // Your preferred fallback.
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545')); 
}

const { sha3 } = window.web3.utils;

const Remittance = truffleContract(remittanceJson);
Remittance.setProvider(web3.currentProvider);

window.addEventListener('load', async () => {

    const accounts = await window.web3.eth.getAccounts();
    console.log("AccountsLength:",accounts.length);
    if (accounts.length === 0) {
       $("#contractBalance").html("NA");
       $("#carolBalance").html("NA");
       $("#aliceBalance").html("NA");
       $("#status").html("No account with which to transact");
       console.log ("ERROR: No Account available");
       return;
    }
    let aliceAccount = accounts[0];
    let carolAccount = accounts[1];

    network = await window.web3.eth.net.getId();
    console.log ("network",network.toString(10));
    let instance;

    try {
       console.log ("Try to get Remittance instance ...");
       instance = await Remittance.deployed();
    }
    catch(error) {
       $("#status").html("error to access node");
       $("#contractBalance").html("NA");
       $("#aliceBalance").html("NA");
       $("#carolBalance").html("NA");
       console.log ("Error:",error);
       return;
    }
    console.log ("contract Address",instance.address);

    await showInfo();

    $("#showInfo").click(async function(){
      console.log ("the showInfo was clicked.");
      await showInfo();
    }); 

    $("#sendFunds").click(async function(){
      console.log ("the sendFunds was clicked.");
      await sendFunds();
    }); 

    $("#withdrawCarol").click(async function(){
      console.log ("the withdrawCarol was clicked.");
      await withdraw(carolAccount);
    }); 
    
    $("#claimAlice").click(async function(){
      console.log ("the withdrawBob was clicked.");
      await claim();
    }); 

    async function showInfo() {
       try {
          const blockNumber = await window.web3.eth.getBlockNumber();
          console.log("blockNumber=", blockNumber.toString(10));
          const maxDeltaBlocks = await instance.maxDeltaBlocks();
          console.log("maxDeltaBlocks=", maxDeltaBlocks.toString(10));
          const contractBalance = await window.web3.eth.getBalance(instance.address);
          console.log ("Contract Balance",contractBalance);
          const aliceBalance = await window.web3.eth.getBalance(aliceAccount);
          console.log("Account[Alice]=", aliceAccount,aliceBalance.toString(10));
          const carolBalance = await window.web3.eth.getBalance(carolAccount);
          console.log("Account[Carol]=", carolAccount,carolBalance.toString(10));

          $("#contractBalance").html(contractBalance.toString(10))
          $("#blockNumber").html(blockNumber.toString(10))
          $("#maxDeltaBlocks").html(maxDeltaBlocks.toString(10))
          $("#aliceBalance").html(aliceBalance.toString(10))
          $("#carolBalance").html(carolBalance.toString(10))
          $("#status").html("OK");
       }
       catch(error) {
          $("#status").html("error to retrive info");
          console.log ("Error:",error);
       }
    }

    async function sendFunds() {
       const GAS = 300000; 

       try {
           let amount = $("input[name='amount']").val();
           let bobSecret = $("input[name='bobSecret']").val();
           let expDeltaBlock = $("input[name='expDeltaBlock']").val();
       
           console.log ("bobSecret: ", bobSecret);
           console.log ("amount: ", amount);
           console.log ("expDeltaBlock: ", expDeltaBlock);
           let completeHash = await instance.hash(sha3(bobSecret), carolAccount);
           console.log('completeHash:',completeHash);

           let txObj = await instance.sendFunds(completeHash, expDeltaBlock,
                { from: aliceAccount, gas: GAS, value: amount})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    };

    async function withdraw(address) {
       const GAS = 300000; 

       try {
           let bobSecret = $("input[name='bobSecret']").val();
       
           console.log ("bobSecret: ", bobSecret);
           let txObj = await instance.withdraw(sha3(bobSecret), { from: address, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
           }
         }
       
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    };

    async function claim() {
       const GAS = 300000; 

       try {
           let bobSecret = $("input[name='bobSecret']").val();
       
           console.log ("bobSecret: ", bobSecret);
           let completeHash = await instance.hash(sha3(bobSecret), carolAccount);
           console.log('completeHash:',completeHash);
           let txObj = await instance.claim(completeHash, { from: aliceAccount, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    };
});
