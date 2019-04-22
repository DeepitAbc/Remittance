"use strict";

// Import the third-party libraries
const Promise = require("bluebird");

web3.eth.expectedExceptionPromise   = require("../utils/expectedExceptionPromise.js");
web3.eth.getEventsPromise           = require("../utils/getEventsPromise.js");
web3.eth.getFirstAccountPromise     = require("../utils/getFirstAccountPromise.js");
web3.eth.promisifyWeb3              = require("../utils/promisifyWeb3.js");
web3.eth.sequentialPromise          = require("../utils/sequentialPromise.js");
web3.eth.getTransactionReceiptMined = require('../utils/getTransactionReceiptMined.js');

const { BN, sha3, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('bn-chai')(BN))
    .should();


const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


// Import the smart contracts
const Remittance       = artifacts.require('Remittance.sol');

contract('Remittance', function(accounts) {
    const MAX_GAS = 4700000;


    let owner, user1, user2, user3;
    before("checking accounts", async function() {
        assert.isAtLeast(accounts.length, 4, "not enough accounts");
        [owner, user1, user2, user3] = accounts;
    });    

    describe('#Remittance()', async function() {

       describe("#constructor()", async function() {
          it("verify if contract is deployed", async function() {
             let instance = await Remittance.new({ from: owner , gas: MAX_GAS})
           });
       });


        describe('Test methods', async function() {
            let instance;

            beforeEach("should deploy Splitter instance",  async function() {
                instance = await Remittance.new({ from: owner , gas: MAX_GAS})
            });

        });
    }); 
}); 


