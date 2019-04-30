"use strict"; 

web3.eth.expectedExceptionPromise   = require("../utils/expectedExceptionPromise.js");
web3.eth.getEventsPromise           = require("../utils/getEventsPromise.js");
web3.eth.getFirstAccountPromise     = require("../utils/getFirstAccountPromise.js");
web3.eth.promisifyWeb3              = require("../utils/promisifyWeb3.js");
web3.eth.sequentialPromise          = require("../utils/sequentialPromise.js");
web3.eth.getTransactionReceiptMined = require('../utils/getTransactionReceiptMined.js');
web3.eth.advanceBlock = require('../utils/advanceBlock.js');

const { BN, sha3, toWei, fromAscii } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('bn-chai')(BN))
    .should();

const MAX_BLOCK = 20;
const DELTA_BLOCK = 10;

const USER_HASH = sha3("User-Secret");
const EXCHANGE_HASH = sha3("exchange-Secret");


// Import the smart contracts
const Remittance       = artifacts.require('Remittance.sol');

contract('Remittance', function(accounts) {
    const MAX_GAS = 4700000;


    let owner, user1, user2, exchange;
    before("checking accounts", async function() {
        assert.isAtLeast(accounts.length, 4, "not enough accounts");
        [owner, user1, user2, exchange] = accounts;
    }); 

    describe('#Remittance()', async function() {
       describe("#constructor()", async function() {
          it("verify if contract is deployed", async function() {
              let instance = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})

              const receipt = await web3.eth.getTransactionReceiptMined(instance.transactionHash);
              receipt.logs.length.should.be.equal(2);
              let logEventCreated = receipt.logs[0];
              logEventCreated.topics[0].should.be.equal(sha3('PauserAdded(address)'));
              logEventCreated = receipt.logs[1];
              logEventCreated.topics[0].should.be.equal(sha3('LogRemittanceCreated(address,uint256)'));
           });
       });

       async function jumpDeltaBlock(deltaBlock) {
          let i;
          for (i = 0; i < deltaBlock; i++)  {
             await web3.eth.advanceBlock();
          }
       }

        describe('Test methods', async function() {
            let instance;

            beforeEach("should deploy Remittance instance",  async function() {
                instance = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})
            });

            describe("#pause()", async function() {
                it("is OK if called by owner", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                   .should.be.fulfilled;
                });

                it("should fail if called by any user", async function() {
                    await web3.eth.expectedExceptionPromise(() => {
                        return instance.pause({ from: user1, gas: MAX_GAS });
                     }, MAX_GAS);
                });

                it("should fail if already paused", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;

                    await web3.eth.expectedExceptionPromise(
                      () => {return instance.pause({ from: owner, gas: MAX_GAS }); }, 
                      MAX_GAS);
                });

                it("emit event", async function() {
                    let result = await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    assert.strictEqual(logEvent.event, "Paused", "Paused name is wrong");
                    assert.strictEqual(logEvent.args.account, owner, "caller is wrong");
                });
            });

            describe("#unpause()", async function() {
                it("is OK if called by owner", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    await instance.unpause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                });

                it("should fail if called by any user", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.unpause({ from: user1, gas: MAX_GAS }); }, 
                      MAX_GAS);
                });

                it("should fail if !paused ", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.unpause({ from: owner, gas: MAX_GAS }); },
                      MAX_GAS);
                });

                it("emit event", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    let result = await instance.unpause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    assert.strictEqual(logEvent.event, "Unpaused", "Unpaused name is wrong");
                    assert.strictEqual(logEvent.args.account, owner, "caller is wrong");
                });
            });

            describe("#sendFunds()", async function() {
                it("should fail if in pause",  async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;

                    const completeHash = await instance.hash(USER_HASH, exchange);
                    const amount = toWei('100', 'Gwei');

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount }); },
                      MAX_GAS);
                });

                const testValidSendFunds = [
                  { amount: 2  },
                  { amount: 10 },
                  { amount: 11 },
                  { amount: 100 },
                  { amount: 101 },
                  { amount: 1000001},
                  { amount: 1000002 }]

                testValidSendFunds.forEach(async function(validRecord) {
                    const amount = validRecord.amount;
                    it(`allowed sendFund() ${amount} wei`, async function() {

                        const completeHash = await instance.hash(USER_HASH, exchange)
                        .should.be.fulfilled;

                        await instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount })
                        .should.be.fulfilled;
   
                        // verifies the stored values
                        let payment = await instance.payments(completeHash);
                        assert.strictEqual(payment.src.toString(), user1.toString(), "beneficiary not stored correctly");
                        assert.strictEqual(payment.amount.toString(), amount.toString(), "amount not stored correctly");
                       
                    });
                });

                it(`fail if same pwd is reused`, async function() {
                    const completeHash = await instance.hash(USER_HASH, exchange)
                    .should.be.fulfilled;

                    const amount1 = toWei('100', 'Gwei');
                    await instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount1 })
                    .should.be.fulfilled;

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount1 }); },
                      MAX_GAS);              
                });

                it("should fail if no ethers ",  async function() { 
                    const completeHash = await instance.hash(USER_HASH, exchange);

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: 0 }); },
                      MAX_GAS);              
                   });

                it("should fail if null hash ",  async function() { 
                    const amount = toWei('100', 'Gwei');
                    const completeHash = await instance.hash(USER_HASH, exchange);

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(fromAscii(''), DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount}); },
                      MAX_GAS);              
                });

                it("should fail if delta block is zero ",  async function() { 
                    const amount = toWei('100', 'Gwei');
                    const completeHash = await instance.hash(USER_HASH, exchange);

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(completeHash, 0, { from: user1, gas: MAX_GAS, value: amount}); },
                      MAX_GAS);              
                });

                it("should fail if delta block is greter MAX",  async function() { 
                    const amount = toWei('100', 'Gwei');
                    const completeHash = await instance.hash(USER_HASH, exchange);

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(completeHash, MAX_BLOCK+1, { from: user1, gas: MAX_GAS, value: amount}); },
                      MAX_GAS);              
                });

                it("should fail if two user use same hash",  async function() { 
                    const amount = toWei('100', 'Gwei');
                    const completeHash = await instance.hash(USER_HASH, exchange);

                    const result = await instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount })
                    .should.be.fulfilled;      

                    const completeHash1 = await instance.hash(USER_HASH, exchange);
          
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.sendFunds(completeHash1, DELTA_BLOCK, { from: user2, gas: MAX_GAS, value: amount}); },
                      MAX_GAS);              
                });
        
                it("verify the emitted event",  async function() {
                    const amount = toWei('100', 'Gwei');
                    const completeHash = await instance.hash(USER_HASH, exchange);

                    const result = await instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount })
                    .should.be.fulfilled;      
         
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];
          
                    let expBlock = await web3.eth.getBlockNumber();
                    let expBlockBN = new BN(expBlock);
                    let deltaBlockBN = new BN(DELTA_BLOCK);
                    expBlockBN = expBlockBN.add(deltaBlockBN);
        
                    assert.strictEqual(logEvent.event, "LogRemittanceSendFunds", "LogRemittanceSendFunds name is wrong");
                    assert.strictEqual(logEvent.args.__length__, 4, "wrogs log args: ",logEvent.args.__length__);
                    assert.strictEqual(logEvent.args.caller, user1, "caller beneficiary is wrong");
                    assert.strictEqual(logEvent.args.amount.toString(), amount.toString(), "arg amount is wrong: " + logEvent.args.amount);
                    assert.strictEqual(logEvent.args.expBlock.toString(), expBlockBN.toString(), "arg expBlock is wrong: " + logEvent.args.expBlock.toString());
                    assert.strictEqual(logEvent.args.hash.toString(), completeHash.toString(), "arg hash is wrong: " + logEvent.args.hash.toString());
              });
            });

            describe("#withdraw()", async function() {        
                let amount;

                beforeEach("should deploy Remittance and deposit funds instance",  async function() {
                    instance = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})
                    amount = toWei('10000', 'Gwei');
                    const completeHash = await instance.hash(USER_HASH, exchange);
                    const result = await instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount });
                });
        
                it("fail if contract is pause",  async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
          
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}); },
                      MAX_GAS);              
               });
      
               it("allowed withdraw",  async function() {        
                   await instance.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}) 
                   .should.be.fulfilled;  
               });

               it("fail if already withdraw",  async function() {        
                   await instance.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}) 
                   .should.be.fulfilled;  
          
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}); },
                      MAX_GAS);              
               });
                
               it("fail if no deposit",  async function() {
                   let instance2 = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})
          
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance2.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}); },
                      MAX_GAS);              
               });
                      
               it("fail if withdraw from other user ",  async function() {
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance.withdraw(USER_HASH, { from: user2, gas: MAX_GAS}); },
                      MAX_GAS);              
               });

               it("fail if USER_HASH is zero",  async function() {
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance.withdraw(fromAscii(''), { from: exchange, gas: MAX_GAS}); },
                      MAX_GAS);              
               });
        
               it("fail if withdraw after MAX_BLOCK",  async function() {
          
                  await jumpDeltaBlock(MAX_BLOCK+1);
          
                  await web3.eth.expectedExceptionPromise(
                      () => { return instance.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}); },
                      MAX_GAS);              
               });
      
               it("emitted event",  async function() {  
                  let contractBalancePre  = await web3.eth.getBalance(instance.address);
                  const contractBalancePreBN = new BN(contractBalancePre);

                  let userBalancePre  = await web3.eth.getBalance(exchange);
                  const userBalancePreBN = new BN(userBalancePre);
        
                  let result = await instance.withdraw(USER_HASH, { from: exchange, gas: MAX_GAS}) 
                  .should.be.fulfilled;
           
                  // calculates transaction total gas
                  let gasUsed = (result.receipt.gasUsed);
                  let gasUsedBN = new BN(gasUsed);
                  let receipt = await web3.eth.getTransaction(result.tx);
                  let gasPrice = receipt.gasPrice;
                  let gasPriceBN = new BN(gasPrice);
                  let totalGasBN = gasPriceBN.mul(gasUsedBN);

                  const amountBN = new BN(amount);

                  let contractBalancePost  = await web3.eth.getBalance(instance.address);
                  const contractBalancePostBN = new BN(contractBalancePost);
                  const expContractBalance = contractBalancePreBN.sub(amountBN);
                  assert.strictEqual(expContractBalance.toString(), contractBalancePostBN.toString(), "contract balance is not correct");

                  let userBalancePost  = await web3.eth.getBalance(exchange);
                  const userBalancePostBN = new BN(userBalancePost);

                  // calculates expected user balances
                  let expectedUserBalance = userBalancePreBN.add(amountBN).sub(totalGasBN);

                  assert.strictEqual(expectedUserBalance.toString(), userBalancePostBN.toString(), "user balances are not correct");
                  let logEvent = result.logs[0];
                  const  expHash = await instance.hash(USER_HASH, exchange);
                  assert.strictEqual(logEvent.args.__length__, 3, "wrogs log args: ",logEvent.args.__length__);
                  assert.strictEqual(logEvent.event, "LogRemittanceWithdraw", "LogRemittanceWithdraw name is wrong");
                  assert.strictEqual(logEvent.args.caller, exchange, "caller beneficiary is wrong");
                  assert.strictEqual(logEvent.args.amount.toString(), amount.toString(), "arg amount is wrong: " + logEvent.args.amount);
                  assert.strictEqual(logEvent.args.hash.toString(), expHash.toString(), "arg hash is wrong: " + logEvent.args.hash);
              });
            });
    
            describe("#claim()", async function() {  
                let completeHash,amount;      

                beforeEach("should deploy Remittance and deposit funds instance",  async function() {
                    instance = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})
                    amount = toWei('10000', 'Gwei');
                    completeHash = await instance.hash(USER_HASH, exchange);
                    const result = await instance.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount })

                    await jumpDeltaBlock(MAX_BLOCK+1)
               });
        
               it("fail if contract is pause",  async function() {
                   await instance.pause({ from: owner, gas: MAX_GAS})
                   .should.be.fulfilled;
          
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance.claim(completeHash, { from: user1, gas: MAX_GAS}); },
                      MAX_GAS);              
              });
      
              it("allowed claim",  async function() {        
                   await instance.claim(completeHash, { from: user1, gas: MAX_GAS}) 
                   .should.be.fulfilled;  
              });

              it("fail if already claimed",  async function() {        
                  await instance.claim(completeHash, { from: user1, gas: MAX_GAS}) 
                  .should.be.fulfilled;  

                  await web3.eth.expectedExceptionPromise(
                      () => { return instance.claim(completeHash, { from: user1, gas: MAX_GAS}); },
                      MAX_GAS);              
              });
        
              it("fail if claim by different user",  async function() {        
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance.claim(completeHash, { from: user2, gas: MAX_GAS}); },
                      MAX_GAS);              
              });

              it("fail if completehash is zero",  async function() {        
                  await web3.eth.expectedExceptionPromise(
                      () => { return instance.claim(fromAscii(''), { from: user1, gas: MAX_GAS}); },
                      MAX_GAS);              
              });
        
              it("fail if no deposit",  async function() {
                  let instance2 = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})

                  let completeHash1 = await instance.hash(USER_HASH, exchange);
          
                  await web3.eth.expectedExceptionPromise(
                      () => { return instance2.claim(completeHash1, { from: user1, gas: MAX_GAS}); },
                      MAX_GAS);              
              });

              it("fail if claim before expTime",  async function() {
                  let instance2 = await Remittance.new(MAX_BLOCK,{ from: owner , gas: MAX_GAS})

                  const amount = toWei('10000', 'Gwei');
                  let completeHash = await instance2.hash(USER_HASH, exchange);

                  const result = await instance2.sendFunds(completeHash, DELTA_BLOCK, { from: user1, gas: MAX_GAS, value: amount })
                  .should.be.fulfilled;    
          
                  await web3.eth.expectedExceptionPromise(
                      () => { return instance2.claim(completeHash, { from: user1, gas: MAX_GAS}); },
                      MAX_GAS);              
              });
      
              it("emitted event",  async function() {       
                  let contractBalancePre  = await web3.eth.getBalance(instance.address);
                  const contractBalancePreBN = new BN(contractBalancePre);
                  let userBalancePre  = await web3.eth.getBalance(user1);
                  const userBalancePreBN = new BN(userBalancePre);
                  const amountBN = new BN(amount);
          
                  let result = await instance.claim(completeHash, { from: user1, gas: MAX_GAS}) 
                  .should.be.fulfilled;  
                      
                  // calculates transaction total gas
                  let gasUsed = (result.receipt.gasUsed);
                  let gasUsedBN = new BN(gasUsed);
                  let receipt = await web3.eth.getTransaction(result.tx);
                  let gasPrice = receipt.gasPrice;
                  let gasPriceBN = new BN(gasPrice);
                  let totalGasBN = gasPriceBN.mul(gasUsedBN);

                  let contractBalancePost  = await web3.eth.getBalance(instance.address);
                  const contractBalancePostBN = new BN(contractBalancePost);
                  const expContractBalance = contractBalancePreBN.sub(amountBN);
                  assert.strictEqual(expContractBalance.toString(), contractBalancePostBN.toString(), "contract balance is not correct");

                  let userBalancePost  = await web3.eth.getBalance(user1);
                  const userBalancePostBN = new BN(userBalancePost);

                  // calculates expected user balances
                  let expectedUserBalance = userBalancePreBN.add(amountBN).sub(totalGasBN);

                  assert.strictEqual(expectedUserBalance.toString(), userBalancePostBN.toString(), "user balances are not correct");
           
                  let logEvent = result.logs[0];
                  assert.strictEqual(logEvent.args.__length__, 3, "wrogs log args: ",logEvent.args.__length__);
                  assert.strictEqual(logEvent.event, "LogRemittanceClaim", "LogRemittanceClaim name is wrong");
                  assert.strictEqual(logEvent.args.caller, user1, "caller beneficiary is wrong");
                  assert.strictEqual(logEvent.args.amount.toString(), amount.toString(), "arg amount is wrong: " + logEvent.args.amount);
                  assert.strictEqual(logEvent.args.hash.toString(), completeHash.toString(), "arg hash is wrong: " + logEvent.args.hash);
              });
          });
       });
    });
});


