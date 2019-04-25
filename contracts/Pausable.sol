pragma solidity ^0.5.0;

import "./Ownable.sol";

/**
 * @title Pausable
 */
contract Pausable is Ownable {
    event LogRemittancePaused(address indexed owner);
    event LogRemittanceResumed(address indexed owner);

    bool private paused;

    modifier isWorking {
        require(!paused);
        _;
    }

    modifier isSuspended {
        require(paused);
        _;
    }


    constructor() internal {
    }


    /**
     * Pause working
     */
    function pause() public isWorking onlyOwner {
        paused = true;

        emit LogRemittancePaused(msg.sender);
    }

    /**
     * Resume working
     */
    function resume() public isSuspended onlyOwner {
        paused = false;

        emit LogRemittanceResumed(msg.sender);
    }
}
